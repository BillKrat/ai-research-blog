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
}
