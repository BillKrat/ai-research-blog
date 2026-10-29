// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Adventures.Security;
using Microsoft.Extensions.Options;
using Xunit;

namespace McpServer.WebApi.Tests.Controllers;

/// <summary>The diagnostics tool over the MCP wire protocol: handshake, tool discovery, tool calls, and the same scope rule as the REST routes.</summary>
public sealed class McpControllerTests : IClassFixture<DiagnosticsControllerTests.TestApp>
{
    private const string SigningKey = "test-signing-key-for-hello-controller-integration-tests-32bytes+";

    private readonly DiagnosticsControllerTests.TestApp _app;

    public McpControllerTests(DiagnosticsControllerTests.TestApp app) => _app = app;

    private HttpClient ClientWith(params string[] scopes)
    {
        var token = new JwtTokenService(Options.Create(new JwtTokenOptions
        {
            Issuer = "AiBlogResearch.WebApi",
            Audience = "AiBlogResearch.Clients",
            SigningKey = SigningKey,
            AccessTokenLifetime = TimeSpan.FromMinutes(5),
        })).IssueClientToken("claude-diagnostics", scopes).AccessToken;
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<JsonElement> RpcAsync(HttpClient client, object message)
    {
        var response = await client.PostAsJsonAsync("/mcp", message);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
    }

    [Fact]
    public async Task Initialize_AnnouncesTheToolsCapability_AndEchoesTheRequestId()
    {
        var answer = await RpcAsync(ClientWith("mcp.diagnostics.read"), new { jsonrpc = "2.0", id = 1, method = "initialize", @params = new { protocolVersion = "2025-03-26" } });

        Assert.Equal(1, answer.GetProperty("id").GetInt32());
        var result = answer.GetProperty("result");
        Assert.Equal("2025-03-26", result.GetProperty("protocolVersion").GetString());
        Assert.True(result.GetProperty("capabilities").TryGetProperty("tools", out _));
    }

    [Fact]
    public async Task ToolsList_OffersTheThreeReadOnlyTools_WithInputSchemas()
    {
        var answer = await RpcAsync(ClientWith("mcp.diagnostics.read"), new { jsonrpc = "2.0", id = "a", method = "tools/list" });

        var tools = answer.GetProperty("result").GetProperty("tools").EnumerateArray().ToList();
        Assert.Equal(["diagnose_request", "recent_exceptions", "exception_signatures"], tools.Select(t => t.GetProperty("name").GetString()));
        Assert.All(tools, t => Assert.Equal("object", t.GetProperty("inputSchema").GetProperty("type").GetString()));
        Assert.Equal("a", answer.GetProperty("id").GetString());
    }

    [Fact]
    public async Task ToolsCall_ForwardsToTheApiWithTheCallersToken_AndReturnsTheAnswerAsText()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"report":{"correlationId":"req-7"}}""") };
        var client = ClientWith("mcp.diagnostics.read");

        var answer = await RpcAsync(client, new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "tools/call",
            @params = new { name = "diagnose_request", arguments = new { correlationId = "req-7" } },
        });

        var result = answer.GetProperty("result");
        Assert.False(result.GetProperty("isError").GetBoolean());
        Assert.Contains("req-7", result.GetProperty("content")[0].GetProperty("text").GetString());
        Assert.Equal("/api/diagnostics/req-7", _app.Api.LastRequest!.RequestUri!.AbsolutePath);
        Assert.Equal(client.DefaultRequestHeaders.Authorization!.Parameter, _app.Api.LastRequest.Headers.Authorization?.Parameter);
    }

    [Fact]
    public async Task ToolsCall_ReportsAnApiRefusalAndAnOutage_AsToolErrors()
    {
        var client = ClientWith("mcp.diagnostics.read");
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.Forbidden);
        var refused = await RpcAsync(client, new { jsonrpc = "2.0", id = 3, method = "tools/call", @params = new { name = "exception_signatures" } });
        Assert.True(refused.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Contains("403", refused.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString());

        _app.Api.Respond = _ => throw new HttpRequestException("api down");
        var down = await RpcAsync(client, new { jsonrpc = "2.0", id = 4, method = "tools/call", @params = new { name = "recent_exceptions", arguments = new { max = 5 } } });
        Assert.True(down.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Contains("could not be reached", down.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString());
    }

    [Fact]
    public async Task UnknownMethodsAndTools_AreJsonRpcErrors_AndANotificationGetsNoBody()
    {
        var client = ClientWith("mcp.diagnostics.read");

        var method = await RpcAsync(client, new { jsonrpc = "2.0", id = 5, method = "resources/list" });
        Assert.Equal(-32601, method.GetProperty("error").GetProperty("code").GetInt32());

        var tool = await RpcAsync(client, new { jsonrpc = "2.0", id = 6, method = "tools/call", @params = new { name = "drop_database" } });
        Assert.Equal(-32602, tool.GetProperty("error").GetProperty("code").GetInt32());

        var notification = await client.PostAsJsonAsync("/mcp", new { jsonrpc = "2.0", method = "notifications/initialized" });
        Assert.Equal(HttpStatusCode.Accepted, notification.StatusCode);
    }

    [Fact]
    public async Task WithoutTheScope_ItIsForbidden_AndWithoutAToken_Unauthorized()
    {
        var message = new { jsonrpc = "2.0", id = 1, method = "tools/list" };

        Assert.Equal(HttpStatusCode.Forbidden, (await ClientWith("mcp.hello").PostAsJsonAsync("/mcp", message)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _app.CreateClient().PostAsJsonAsync("/mcp", message)).StatusCode);
    }

    [Fact]
    public async Task ToolsList_ShowsACallerOnlyTheToolsItsScopesAllow()
    {
        var diagnostics = await RpcAsync(ClientWith("mcp.diagnostics.read"), new { jsonrpc = "2.0", id = 1, method = "tools/list" });
        var authoring = await RpcAsync(ClientWith("content.draft"), new { jsonrpc = "2.0", id = 2, method = "tools/list" });
        var both = await RpcAsync(ClientWith("mcp.diagnostics.read", "content.draft"), new { jsonrpc = "2.0", id = 3, method = "tools/list" });

        string[] Names(JsonElement answer) => answer.GetProperty("result").GetProperty("tools").EnumerateArray().Select(t => t.GetProperty("name").GetString()!).ToArray();
        Assert.Equal(["diagnose_request", "recent_exceptions", "exception_signatures"], Names(diagnostics));
        Assert.Equal(["list_my_posts", "create_draft_post", "update_draft_post", "propose_revision", "list_post_comments", "add_post_comment", "list_my_collaboration", "get_collaboration_item", "create_collaboration_item", "update_collaboration_item", "list_collaboration_comments", "add_collaboration_comment", "list_categories", "list_tags", "create_category", "create_tag"], Names(authoring));
        Assert.Equal(19, Names(both).Length);
    }

    [Fact]
    public async Task CreateDraftPost_ForwardsTheArgumentsAsAPostToTheAuthoringApi_WithTheCallersToken()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.Created) { Content = new StringContent("""{"id":"p1","title":"How Pages Work","isPublished":false}""") };
        var client = ClientWith("content.draft");

        var answer = await RpcAsync(client, new
        {
            jsonrpc = "2.0",
            id = 4,
            method = "tools/call",
            @params = new
            {
                name = "create_draft_post",
                arguments = new { title = "How Pages Work", content = "# Pages", categories = new[] { "Help" }, tags = new[] { "Pages" } },
            },
        });

        var result = answer.GetProperty("result");
        Assert.False(result.GetProperty("isError").GetBoolean());
        Assert.Contains("\"isPublished\":false", result.GetProperty("content")[0].GetProperty("text").GetString());
        Assert.Equal("POST", _app.Api.LastRequest!.Method.Method);
        Assert.Equal("/api/author/posts", _app.Api.LastRequest.RequestUri!.AbsolutePath);
        Assert.Equal(client.DefaultRequestHeaders.Authorization!.Parameter, _app.Api.LastRequest.Headers.Authorization?.Parameter);
        using var sent = JsonDocument.Parse(_app.Api.LastBody!);
        Assert.Equal("How Pages Work", sent.RootElement.GetProperty("title").GetString());
        Assert.Equal("Help", sent.RootElement.GetProperty("categories")[0].GetString());
    }

    [Fact]
    public async Task GetCollaborationItem_ReadsOneItemFromTheAuthoringApi_WithTheCallersToken_AndNeedsAnId()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"summary":{"id":"i1"},"content":"## Test steps","truncated":false}""") };
        var client = ClientWith("content.draft");

        var answer = await RpcAsync(client, new { jsonrpc = "2.0", id = 7, method = "tools/call", @params = new { name = "get_collaboration_item", arguments = new { id = "i 1" } } });

        var result = answer.GetProperty("result");
        Assert.False(result.GetProperty("isError").GetBoolean());
        Assert.Contains("## Test steps", result.GetProperty("content")[0].GetProperty("text").GetString());
        Assert.Equal("GET", _app.Api.LastRequest!.Method.Method);
        Assert.Equal("/api/author/collaboration/i%201", _app.Api.LastRequest.RequestUri!.AbsolutePath);
        Assert.Equal(client.DefaultRequestHeaders.Authorization!.Parameter, _app.Api.LastRequest.Headers.Authorization?.Parameter);

        var missing = await RpcAsync(client, new { jsonrpc = "2.0", id = 8, method = "tools/call", @params = new { name = "get_collaboration_item", arguments = new { } } });
        Assert.True(missing.GetProperty("result").GetProperty("isError").GetBoolean());
    }

    [Fact]
    public async Task UpdateDraftPost_PutsToThePostId_WithoutTheIdInTheBody_AndSurfacesTheApisRefusal()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.Conflict) { Content = new StringContent("This post is published.") };

        var answer = await RpcAsync(ClientWith("content.draft"), new
        {
            jsonrpc = "2.0",
            id = 5,
            method = "tools/call",
            @params = new { name = "update_draft_post", arguments = new { id = "p9", title = "Edited" } },
        });

        Assert.Equal("PUT", _app.Api.LastRequest!.Method.Method);
        Assert.Equal("/api/author/posts/p9", _app.Api.LastRequest.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(_app.Api.LastBody!);
        Assert.False(sent.RootElement.TryGetProperty("id", out _));
        var result = answer.GetProperty("result");
        Assert.True(result.GetProperty("isError").GetBoolean());
        Assert.Contains("409", result.GetProperty("content")[0].GetProperty("text").GetString());
    }

    [Fact]
    public async Task AToolOfAnotherScope_IsRefusedAsAToolError_AndNothingIsForwarded()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.OK);
        _app.Api.ResetForTests();

        var authoringOnly = await RpcAsync(ClientWith("content.draft"), new
        {
            jsonrpc = "2.0", id = 6, method = "tools/call", @params = new { name = "recent_exceptions" },
        });
        var diagnosticsOnly = await RpcAsync(ClientWith("mcp.diagnostics.read"), new
        {
            jsonrpc = "2.0", id = 7, method = "tools/call", @params = new { name = "create_draft_post", arguments = new { title = "x" } },
        });

        Assert.True(authoringOnly.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Contains("mcp.diagnostics.read", authoringOnly.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString());
        Assert.True(diagnosticsOnly.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Contains("content.draft", diagnosticsOnly.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString());
        Assert.Null(_app.Api.LastRequest);
    }

    [Fact]
    public async Task ProposeRevision_PostsTheChangesToTheRevisionRoute_WithoutTheIdInTheBody()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"id":"r1","isPublished":false,"revisionOf":"p1"}""") };

        var answer = await RpcAsync(ClientWith("content.draft"), new
        {
            jsonrpc = "2.0",
            id = 8,
            method = "tools/call",
            @params = new { name = "propose_revision", arguments = new { id = "p1", content = "new body" } },
        });

        Assert.False(answer.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Equal("POST", _app.Api.LastRequest!.Method.Method);
        Assert.Equal("/api/author/posts/p1/revision", _app.Api.LastRequest.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(_app.Api.LastBody!);
        Assert.False(sent.RootElement.TryGetProperty("id", out _));
        Assert.Equal("new body", sent.RootElement.GetProperty("content").GetString());
    }

    [Fact]
    public async Task PostComments_AreReadAndAddedThroughTheOwnPostConversationRoutes_WithoutTheIdInTheBody()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("[]") };
        var read = await RpcAsync(ClientWith("content.draft"), new { jsonrpc = "2.0", id = 9, method = "tools/call", @params = new { name = "list_post_comments", arguments = new { id = "p1" } } });

        Assert.False(read.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Equal("GET", _app.Api.LastRequest!.Method.Method);
        Assert.Equal("/api/author/posts/p1/comments", _app.Api.LastRequest.RequestUri!.AbsolutePath);

        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.Created) { Content = new StringContent("{}") };
        var add = await RpcAsync(ClientWith("content.draft"), new { jsonrpc = "2.0", id = 10, method = "tools/call", @params = new { name = "add_post_comment", arguments = new { id = "p1", text = "Answering item 1." } } });

        Assert.False(add.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Equal("POST", _app.Api.LastRequest!.Method.Method);
        Assert.Equal("/api/author/posts/p1/comments", _app.Api.LastRequest.RequestUri!.AbsolutePath);
        using var sent = JsonDocument.Parse(_app.Api.LastBody!);
        Assert.False(sent.RootElement.TryGetProperty("id", out _));
        Assert.Equal("Answering item 1.", sent.RootElement.GetProperty("text").GetString());

        var missing = await RpcAsync(ClientWith("content.draft"), new { jsonrpc = "2.0", id = 11, method = "tools/call", @params = new { name = "add_post_comment", arguments = new { id = "p1" } } });
        Assert.True(missing.GetProperty("result").GetProperty("isError").GetBoolean());
    }
}
