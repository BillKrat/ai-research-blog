using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Adventures.Entities;
using Adventures.Identity;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// The schema browser routes through the real pipeline: off unless <c>Browser:Enabled</c>, a signed-in person with <c>schema.read</c> only, never with a
/// token of another site or while a password change is due.
/// </summary>
public sealed class SchemaBrowserHostTests
{
    private sealed class Rights : IRightsResolver
    {
        public Task<IReadOnlySet<string>> ResolveAsync(string userName, IEnumerable<string> signInRoles, string tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlySet<string>>(new HashSet<string> { userName == "reader" ? Adventures.Entities.Rights.SchemaRead : Adventures.Entities.Rights.PostsRead });

        public Task<IReadOnlySet<string>> ResolveIfRoleAsync(string userName, string roleId, string roleRights, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<IReadOnlySet<string>> ResolveAcrossTenantsAsync(string userName, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class OneSite : ITenantResolver
    {
        public Task<CurrentTenant> ResolveAsync(string? host, string? fallbackDomain = null, CancellationToken cancellationToken = default) =>
            Task.FromResult(new CurrentTenant("site-a", "Site A", "a.test", host ?? string.Empty, TenantMatch.Domain));
    }

    private sealed class NoFirstRunSite : IFirstRunSite
    {
        public Task<bool> TryCreateFirstSiteAsync(string host, CancellationToken cancellationToken = default) => Task.FromResult(false);
    }

    private sealed class ChangeDue : IPasswordChangeGate
    {
        public Task<bool> IsPendingAsync(Guid userId, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private static WebApplicationFactory<Program> Host(bool enabled) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            builder.UseSetting("Browser:Enabled", enabled ? "true" : "false");
            builder.ConfigureTestServices(services =>
            {
                services.AddScoped<IRightsResolver, Rights>();
                services.AddScoped<ITenantResolver, OneSite>();
                services.AddScoped<IFirstRunSite, NoFirstRunSite>();
                services.AddScoped<IPasswordChangeGate, ChangeDue>(); // asked only for a token marked "change your password"
            });
        });

    private static HttpClient Client(WebApplicationFactory<Program> factory, string? user, params Claim[] extra)
    {
        var client = factory.CreateClient();
        if (user is not null)
        {
            var token = factory.Services.GetRequiredService<IJwtTokenService>().IssueToken(Guid.NewGuid().ToString(), [new Claim(ClaimTypes.Name, user), .. extra]);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        }

        return client;
    }

    [Fact]
    public async Task A_reader_sees_the_schemas_of_the_site_and_one_schema()
    {
        using var factory = Host(enabled: true);
        var client = Client(factory, "reader", new Claim(WellKnownClaims.Tenant, "a.test"));

        var context = await client.GetFromJsonAsync<SchemaBrowserContext>("/api/browser/context");
        var list = await client.GetFromJsonAsync<SchemaCatalogList>("/api/browser/schemas");
        var user = Assert.Single(list!.Schemas, s => s.Name == "User");
        var detail = await client.GetFromJsonAsync<SchemaDetail>($"/api/browser/schema?id={Uri.EscapeDataString(user.Id)}");

        Assert.Equal("a.test", context!.SiteDomain);
        Assert.Empty(list.Unreadable);
        Assert.Contains(list.Schemas, s => s.Name == "Post"); // every schema of the installation, features included
        Assert.Contains(detail!.Fields, f => f.Name == "UserName");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/browser/schema?id=urn%3Anothing")).StatusCode);
    }

    [Theory]
    [InlineData("/api/browser/context")]
    [InlineData("/api/browser/schemas")]
    [InlineData("/api/browser/schema?id=urn%3Aany")]
    public async Task Nobody_else_gets_in(string path)
    {
        using var factory = Host(enabled: true);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Client(factory, null).GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client(factory, "writer").GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client(factory, "reader", new Claim(WellKnownClaims.Tenant, "b.test")).GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client(factory, "reader", new Claim(WellKnownClaims.PasswordChange, "true")).GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task The_routes_do_not_exist_unless_switched_on()
    {
        using var factory = Host(enabled: false);

        Assert.Equal(HttpStatusCode.NotFound, (await Client(factory, "reader").GetAsync("/api/browser/schemas")).StatusCode);
    }

    [Fact]
    public async Task Nothing_can_be_changed_through_the_browser_routes()
    {
        using var factory = Host(enabled: true);
        var client = Client(factory, "reader");

        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await client.PostAsJsonAsync("/api/browser/schemas", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await client.DeleteAsync("/api/browser/schemas")).StatusCode);
    }
}
