using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Adventures.Entities;
using Adventures.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// T1 through the real pipeline (the middleware order in Program.cs, the real controllers and a real signed token): the tenant comes from the host the
/// server saw; a host that matches no tenant is refused when enforcement is on; a token signed in for another tenant is refused. Two known tenants are
/// substituted for the tenant store (the seeded store has none); everything else is the app.
/// </summary>
public sealed class TenancyPipelineTests
{
    private const string RefusedTitle = "No site is set up for this address.";

    private sealed class KnownTenants(params string[] domains) : ITenantResolver
    {
        public Task<CurrentTenant> ResolveAsync(string? host, string? fallbackDomain = null, CancellationToken cancellationToken = default)
        {
            var name = (host ?? string.Empty).Split(':')[0].ToLowerInvariant();
            var hit = domains.FirstOrDefault(d => name == d || name.EndsWith("." + d, StringComparison.Ordinal));
            return Task.FromResult(hit is null
                ? new CurrentTenant(null, null, null, host ?? string.Empty, TenantMatch.None)
                : new CurrentTenant(hit + "-id", hit, hit, host ?? string.Empty, TenantMatch.Domain));
        }
    }

    private static WebApplicationFactory<Program> Host(string? enforcement)
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Data:Mode", "Legacy");
            builder.UseSetting("ConnectionStrings:LegacySql", "Server=unused;Database=unused;User Id=u;Password=p;TrustServerCertificate=true");
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            if (enforcement is not null)
            {
                builder.UseSetting("Tenancy:Enforcement", enforcement);
            }

            builder.ConfigureTestServices(services =>
            {
                services.AddScoped<ITenantResolver>(_ => new KnownTenants("acme.test", "other.test"));
            });
        });
    }

    private static HttpClient As(WebApplicationFactory<Program> factory, string host, string? token = null)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Host = host;
        if (token is not null)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return client;
    }

    /// <summary>An anonymous call that reaches a controller (it answers 400 for the missing credentials) when the pipeline lets it through.</summary>
    private static Task<HttpResponseMessage> Reach(HttpClient client) => client.PostAsJsonAsync("/api/auth/token", new { });

    private static string Token(WebApplicationFactory<Program> factory, string? tenant, string roles = "Reader")
    {
        var claims = new List<Claim> { new(ClaimTypes.Name, "ann"), new(WellKnownClaims.Roles, roles) };
        if (tenant is not null)
        {
            claims.Add(new Claim(WellKnownClaims.Tenant, tenant));
        }

        return factory.Services.GetRequiredService<IJwtTokenService>().IssueToken(Guid.NewGuid().ToString(), claims).AccessToken;
    }

    [Fact]
    public async Task EnforcedHostThatMatchesNoTenantGets404_AKnownTenantsHostIsServed()
    {
        using var factory = Host("Enforce");

        var refused = await Reach(As(factory, "unbound.example"));
        var served = await Reach(As(factory, "api.acme.test"));

        Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
        Assert.Contains(RefusedTitle, await refused.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, served.StatusCode);
    }

    [Fact]
    public async Task SpoofedHeadersCannotMakeAnUnknownHostAKnownOne()
    {
        using var factory = Host("Enforce");
        var client = As(factory, "unbound.example");
        client.DefaultRequestHeaders.Add("X-Forwarded-Host", "api.acme.test");
        client.DefaultRequestHeaders.Add("Origin", "https://www.acme.test");
        client.DefaultRequestHeaders.Add("Referer", "https://www.acme.test/admin");

        var response = await Reach(client);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task TheInfrastructureChecksAnswerOnAnyHost_EvenWhenEnforced()
    {
        using var factory = Host("Enforce");

        Assert.NotEqual(HttpStatusCode.NotFound, (await As(factory, "unbound.example").GetAsync("/")).StatusCode);
        Assert.NotEqual(HttpStatusCode.NotFound, (await As(factory, "unbound.example").GetAsync("/api/health")).StatusCode);
    }

    [Fact]
    public async Task WithNothingConfiguredTheSiteKeepsServingEveryHost_SoSwitchingItOnIsASeparateStep()
    {
        using var factory = Host(enforcement: null);

        var response = await Reach(As(factory, "unbound.example"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ATokenSignedInForAnotherTenantIsRefusedOnThisDomain_AndWorksOnItsOwn()
    {
        using var factory = Host("Enforce");
        var acmeToken = Token(factory, "acme.test");

        var onItsOwn = await As(factory, "api.acme.test", acmeToken).GetAsync("/api/tenant/current");
        var replayed = await As(factory, "api.other.test", acmeToken).GetAsync("/api/tenant/current");

        Assert.Equal(HttpStatusCode.OK, onItsOwn.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, replayed.StatusCode);
        Assert.Contains("another site", await replayed.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ATokenWithNoTenantClaimIsNotCheckedAndTheDisplayedTenantIsTheHosts()
    {
        using var factory = Host("Enforce");
        var machineLike = Token(factory, tenant: null);

        var response = await As(factory, "api.other.test", machineLike).GetAsync("/api/tenant/current");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("other.test", body);
        Assert.Contains("\"match\":\"Domain\"", body);
    }
}
