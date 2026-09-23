using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Adventures.Security;
using McpServer.WebApi.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xunit;

namespace McpServer.WebApi.Tests.Controllers;

/// <summary>
/// Integration tests (real ASP.NET Core pipeline via <see cref="WebApplicationFactory{TEntryPoint}"/>,
/// not a bare controller-action call) because the thing actually being proven here is that the
/// [Authorize(Policy = "Scope:mcp.hello")] wiring - JWT bearer validation + ScopeAuthorizationHandler -
/// really rejects/accepts requests, not just that the action method returns the right payload.
/// </summary>
public sealed class HelloControllerTests : IClassFixture<HelloControllerTests.TestApp>
{
    private const string SigningKey = "test-signing-key-for-hello-controller-integration-tests-32bytes+";
    private const string Issuer = "AiBlogResearch.WebApi";
    private const string Audience = "AiBlogResearch.Clients";

    private readonly TestApp _app;

    public HelloControllerTests(TestApp app) => _app = app;

    private static string IssueToken(IEnumerable<string> scopes)
    {
        var tokenService = new JwtTokenService(Options.Create(new JwtTokenOptions
        {
            Issuer = Issuer,
            Audience = Audience,
            SigningKey = SigningKey,
            AccessTokenLifetime = TimeSpan.FromMinutes(5),
        }));

        return tokenService.IssueClientToken("mcp-host", scopes).AccessToken;
    }

    [Fact]
    public async Task Get_ReturnsHelloWorld_WhenTokenHasRequiredScope()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", IssueToken([HelloController.RequiredScope]));

        var response = await client.GetAsync("/api/hello");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HelloResponse>();
        Assert.Equal("hello world", body?.Message);
    }

    [Fact]
    public async Task Get_ReturnsUnauthorized_WhenNoTokenIsSupplied()
    {
        var client = _app.CreateClient();

        var response = await client.GetAsync("/api/hello");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_ReturnsForbidden_WhenTokenIsMissingRequiredScope()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", IssueToken(["mcp.postgres.query"]));

        var response = await client.GetAsync("/api/hello");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    /// <summary>
    /// Boots the real app with a fixed test-only Jwt:SigningKey. Set as a process environment
    /// variable (not via ConfigureWebHost/ConfigureAppConfiguration) because Adventures.Security's
    /// AddSharedJwtAuthentication reads JwtTokenOptions eagerly - synchronously, during
    /// Program.cs's own AddSharedJwtAuthentication(builder.Configuration) call, before
    /// WebApplicationBuilder.Build() - so a config source added via WebApplicationFactory's own
    /// host-customization hooks arrives too late to affect it. An env var set before the factory's
    /// first host build is already present when Program.cs's top-level code runs and reads it.
    /// </summary>
    public sealed class TestApp : WebApplicationFactory<Program>
    {
        static TestApp() => Environment.SetEnvironmentVariable("Jwt__SigningKey", SigningKey);
    }
}
