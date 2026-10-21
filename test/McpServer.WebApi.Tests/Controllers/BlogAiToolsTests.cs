using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Adventures.Security;
using McpServer.WebApi.BlogAi;
using Microsoft.Extensions.Options;
using Xunit;

namespace McpServer.WebApi.Tests.Controllers;

/// <summary>The legacy-data (BlogAI) tools: the catalogue can only read, can never reach a secret column, and sits behind its own scope.</summary>
public sealed class BlogAiToolsTests : IClassFixture<DiagnosticsControllerTests.TestApp>
{
    private const string SigningKey = "test-signing-key-for-hello-controller-integration-tests-32bytes+";

    private readonly DiagnosticsControllerTests.TestApp _app;

    public BlogAiToolsTests(DiagnosticsControllerTests.TestApp app) => _app = app;

    public static TheoryData<string> QueryNames() => new(BlogAiCatalog.Queries.Select(q => q.Name));

    [Theory]
    [MemberData(nameof(QueryNames))]
    public void EveryQuery_IsASingleSelect_WithNoWriteKeyword(string name)
    {
        var sql = BlogAiCatalog.Find(name)!.Sql;

        Assert.Matches(@"^\s*(SELECT|WITH)\b", sql);
        Assert.DoesNotContain(";", sql);
        Assert.DoesNotMatch(new Regex(@"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|GRANT|INTO)\b", RegexOptions.IgnoreCase), sql);
    }

    [Theory]
    [MemberData(nameof(QueryNames))]
    public void EveryQuery_UsesExactlyTheParametersItDeclares(string name)
    {
        var query = BlogAiCatalog.Find(name)!;

        var used = Regex.Matches(query.Sql, @"@(\w+)").Select(m => m.Groups[1].Value).ToHashSet();
        Assert.Equal(query.Parameters.Select(p => p.Name).ToHashSet(), used);
    }

    [Fact]
    public void NoQuery_SelectsASecretColumn_OrFileContents()
    {
        var all = string.Join('\n', BlogAiCatalog.Queries.Select(q => q.Sql));

        Assert.DoesNotMatch(new Regex(@"\bPassword\b", RegexOptions.IgnoreCase), all.Replace("%pass%", string.Empty, StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotMatch(new Regex(@"\bContents\b", RegexOptions.IgnoreCase), all);
        Assert.DoesNotContain("AspNetUsers", all);
        Assert.DoesNotContain("be_DataStoreSettings.Settings", all);
    }

    [Fact]
    public void QueryNames_AreUnique_AndPrefixed()
    {
        Assert.Equal(BlogAiCatalog.Queries.Count, BlogAiCatalog.Queries.Select(q => q.Name).Distinct().Count());
        Assert.All(BlogAiCatalog.Queries, q => Assert.StartsWith("blogai_", q.Name));
    }

    private HttpClient ClientWith(params string[] scopes)
    {
        var token = new JwtTokenService(Options.Create(new JwtTokenOptions
        {
            Issuer = "AiBlogResearch.WebApi",
            Audience = "AiBlogResearch.Clients",
            SigningKey = SigningKey,
            AccessTokenLifetime = TimeSpan.FromMinutes(5),
        })).IssueClientToken("claude-research", scopes).AccessToken;
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<JsonElement> RpcAsync(HttpClient client, object message)
    {
        var response = await client.PostAsJsonAsync("/mcp", message);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
    }

    [Fact]
    public async Task ToolsList_ShowsTheLegacyTools_OnlyToATokenWithTheBlogAiScope()
    {
        var with = await RpcAsync(ClientWith("blogai.read"), new { jsonrpc = "2.0", id = 1, method = "tools/list" });
        var without = await RpcAsync(ClientWith("mcp.diagnostics.read"), new { jsonrpc = "2.0", id = 2, method = "tools/list" });

        var names = with.GetProperty("result").GetProperty("tools").EnumerateArray().Select(t => t.GetProperty("name").GetString()).ToList();
        Assert.Equal(BlogAiCatalog.Queries.Select(q => q.Name), names);
        Assert.DoesNotContain(without.GetProperty("result").GetProperty("tools").EnumerateArray(), t => t.GetProperty("name").GetString()!.StartsWith("blogai_"));
    }

    [Fact]
    public async Task ToolsCall_WithoutTheScope_IsRefusedAsAToolError()
    {
        var answer = await RpcAsync(ClientWith("mcp.diagnostics.read"), new { jsonrpc = "2.0", id = 3, method = "tools/call", @params = new { name = "blogai_tables", arguments = new { } } });

        Assert.True(answer.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Contains("blogai.read", answer.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString());
    }

    [Fact]
    public async Task ToolsCall_WithTheScope_SaysSoWhenTheDatabaseIsNotConfigured()
    {
        var answer = await RpcAsync(ClientWith("blogai.read"), new { jsonrpc = "2.0", id = 4, method = "tools/call", @params = new { name = "blogai_tables", arguments = new { } } });

        Assert.True(answer.GetProperty("result").GetProperty("isError").GetBoolean());
        Assert.Contains("not configured", answer.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString());
    }
}
