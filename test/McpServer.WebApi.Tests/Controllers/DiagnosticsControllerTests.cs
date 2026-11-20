// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Net;
using System.Net.Http.Headers;
using Adventures.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace McpServer.WebApi.Tests.Controllers;

/// <summary>The MCP diagnostics tool: scope-protected, forwards to the API with the caller's token, passes the answer through.</summary>
public sealed class DiagnosticsControllerTests : IClassFixture<DiagnosticsControllerTests.TestApp>
{
    private const string SigningKey = "test-signing-key-for-hello-controller-integration-tests-32bytes+";

    private readonly TestApp _app;

    public DiagnosticsControllerTests(TestApp app) => _app = app;

    private static string IssueToken(params string[] scopes) =>
        new JwtTokenService(Options.Create(new JwtTokenOptions
        {
            Issuer = "AiBlogResearch.WebApi",
            Audience = "AiBlogResearch.Clients",
            SigningKey = SigningKey,
            AccessTokenLifetime = TimeSpan.FromMinutes(5),
        })).IssueClientToken("claude-diagnostics", scopes).AccessToken;

    private HttpClient ClientWith(params string[] scopes)
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", IssueToken(scopes));
        return client;
    }

    [Fact]
    public async Task ForRequest_ForwardsToTheApiWithTheCallersToken_AndPassesTheAnswerThrough()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"report":{"correlationId":"req-9"}}""") };
        var client = ClientWith("mcp.diagnostics.read");

        var response = await client.GetAsync("/api/diagnostics/req-9");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("req-9", await response.Content.ReadAsStringAsync());
        Assert.Equal("/api/diagnostics/req-9", _app.Api.LastRequest!.RequestUri!.AbsolutePath);
        Assert.Equal("Bearer", _app.Api.LastRequest.Headers.Authorization?.Scheme);
        Assert.Equal(client.DefaultRequestHeaders.Authorization!.Parameter, _app.Api.LastRequest.Headers.Authorization?.Parameter);
    }

    [Fact]
    public async Task ForRequest_PassesTheApisRefusalThrough()
    {
        _app.Api.Respond = _ => new HttpResponseMessage(HttpStatusCode.Forbidden);

        var response = await ClientWith("mcp.diagnostics.read").GetAsync("/api/diagnostics/recent");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ForRequest_AnswersBadGateway_WhenTheApiCannotBeReached()
    {
        _app.Api.Respond = _ => throw new HttpRequestException("api down");

        var response = await ClientWith("mcp.diagnostics.read").GetAsync("/api/diagnostics/signatures");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Contains("correlationId", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task WithoutTheScope_ItIsForbidden_AndWithoutAToken_Unauthorized()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await ClientWith("mcp.hello").GetAsync("/api/diagnostics/req-9")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _app.CreateClient().GetAsync("/api/diagnostics/req-9")).StatusCode);
    }

    public sealed class StubApi : DelegatingHandler
    {
        public Func<HttpRequestMessage, HttpResponseMessage> Respond { get; set; } = _ => new HttpResponseMessage(HttpStatusCode.OK);

        public HttpRequestMessage? LastRequest { get; private set; }

        public string? LastBody { get; private set; }

        /// <summary>What GET /api/tools offers before the token's scopes are applied: by default the real declarations of the three feature libraries.</summary>
        public Func<IReadOnlyList<Adventures.Tools.IAppTool>> Manifest { get; set; } = () =>
            [.. Adventures.Diagnostics.WebApi.DiagnosticsTools.All, .. Adventures.Blog.WebApi.AuthoringTools.All, .. Adventures.Collaboration.WebApi.CollaborationAuthoringTools.All];

        /// <summary>When set, the manifest request fails like an unreachable API.</summary>
        public bool ManifestDown { get; set; }

        public int ManifestRequests { get; private set; }

        public void ResetForTests()
        {
            LastRequest = null;
            LastBody = null;
            ManifestRequests = 0;
        }

        private HttpResponseMessage ManifestAnswer(HttpRequestMessage request)
        {
            ManifestRequests++;
            if (ManifestDown)
            {
                throw new HttpRequestException("api down");
            }

            // Like the real endpoint: only the tools the token's scopes allow.
            var scopes = TokenScopes(request.Headers.Authorization?.Parameter);
            var tools = Manifest().Where(t => scopes.Contains(t.RequiredScope)).Select(t => new
            {
                name = t.Name,
                description = t.Description,
                inputSchema = System.Text.Json.JsonDocument.Parse(t.InputSchema).RootElement,
                requiredScope = t.RequiredScope,
                method = t.Method,
                path = t.PathTemplate,
            });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(System.Text.Json.JsonSerializer.Serialize(tools), System.Text.Encoding.UTF8, "application/json") };
        }

        private static HashSet<string> TokenScopes(string? jwt)
        {
            var scopes = new HashSet<string>(StringComparer.Ordinal);
            var payload = jwt?.Split('.').ElementAtOrDefault(1);
            if (payload is null)
            {
                return scopes;
            }

            var padded = payload.Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
            using var json = System.Text.Json.JsonDocument.Parse(Convert.FromBase64String(padded));
            if (json.RootElement.TryGetProperty("scope", out var claim))
            {
                var values = claim.ValueKind == System.Text.Json.JsonValueKind.Array ? claim.EnumerateArray().Select(v => v.GetString() ?? "") : [claim.GetString() ?? ""];
                foreach (var value in values.SelectMany(v => v.Split(' ', StringSplitOptions.RemoveEmptyEntries)))
                {
                    scopes.Add(value);
                }
            }

            return scopes;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Method == HttpMethod.Get && request.RequestUri!.AbsolutePath == "/api/tools")
            {
                return Task.FromResult(ManifestAnswer(request));
            }

            LastRequest = request;
            LastBody = request.Content?.ReadAsStringAsync(cancellationToken).GetAwaiter().GetResult();
            return Task.FromResult(Respond(request));
        }
    }

    public sealed class TestApp : WebApplicationFactory<Program>
    {
        static TestApp() => Environment.SetEnvironmentVariable("Jwt__SigningKey", SigningKey);

        public StubApi Api { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder) =>
            builder.ConfigureServices(services =>
                services.AddHttpClient("Api").ConfigurePrimaryHttpMessageHandler(() => Api));
    }
}
