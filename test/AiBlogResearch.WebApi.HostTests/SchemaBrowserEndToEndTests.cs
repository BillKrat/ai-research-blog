using System.Security.Claims;
using Adventures.Browser.Client;
using Adventures.Browser.Gateway.WebApi;
using Adventures.Entities;
using Adventures.Identity;
using Adventures.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// The schema browser from end to end, in memory: the client library the applications use, through the browser gateway, into this API's real pipeline.
/// Only the password check and the rights lookup are stand-ins; the token, the tenant checks, the routes and the schemas are real.
/// </summary>
public sealed class SchemaBrowserEndToEndTests
{
    private sealed class Accounts(IJwtTokenService tokens) : IUserAccountService
    {
        public Task<LoginResult> LoginAsync(string tenant, string username, string password, CancellationToken cancellationToken = default)
        {
            if (password != "right")
            {
                return Task.FromResult(new LoginResult(false, null, null, false, default));
            }

            var token = tokens.IssueToken(Guid.NewGuid().ToString(), [new Claim(ClaimTypes.Name, username), new Claim(WellKnownClaims.Tenant, tenant)]);
            return Task.FromResult(new LoginResult(true, token.AccessToken, token.ExpiresAtUtc, false, default));
        }

        public Task<ChangePasswordResult> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }

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

    private static WebApplicationFactory<Program> Site() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            builder.UseSetting("Browser:Enabled", "true");
            builder.ConfigureTestServices(services =>
            {
                services.AddScoped<IUserAccountService, Accounts>();
                services.AddScoped<IRightsResolver, Rights>();
                services.AddScoped<ITenantResolver, OneSite>();
                services.AddScoped<IFirstRunSite, NoFirstRunSite>();
            });
        });

    private static async Task<WebApplication> GatewayAsync(WebApplicationFactory<Program> site)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["BrowserGateway:Sites:0:Domain"] = "a.test",
            ["BrowserGateway:Sites:0:Api"] = "https://a.test/",
        });
        builder.Services.AddControllers().ConfigureApplicationPartManager(parts =>
        {
            parts.ApplicationParts.Clear(); // the gateway alone, not this API's controllers
            parts.ApplicationParts.Add(new AssemblyPart(typeof(SiteGatewayController).Assembly));
        });
        builder.Services.AddBrowserGateway(builder.Configuration);
        builder.Services.AddHttpClient(SiteForwarder.ClientName).ConfigurePrimaryHttpMessageHandler(() => site.Server.CreateHandler());
        var gateway = builder.Build();
        gateway.UseBrowserGateway();
        gateway.MapControllers();
        await gateway.StartAsync();
        return gateway;
    }

    [Fact]
    public async Task A_person_signs_in_to_a_configured_domain_and_browses_its_schemas()
    {
        using var site = Site();
        await using var gateway = await GatewayAsync(site);
        var api = new BrowserApi(new HttpClient(gateway.GetTestServer().CreateHandler()) { BaseAddress = new Uri("https://browser.test/") });

        Assert.Equal(SiteSignInResult.Refused, await api.SignInAsync("a.test", "reader", "wrong"));
        Assert.Equal(SiteSignInResult.SignedIn, await api.SignInAsync("a.test", "reader", "right"));

        var browser = new SchemaBrowserViewModel(api, "a.test");
        await browser.LoadAsync();
        Assert.Null(browser.Error);
        Assert.Equal("Site A", browser.SiteTitle);
        var user = Assert.Single(browser.Areas.SelectMany(a => a.Schemas), s => s.Name == "User");
        await browser.OpenAsync(user.Id);
        Assert.Contains(browser.Detail!.Fields, f => f.Name == "UserName");
        Assert.NotEmpty(browser.Detail.UsedBy);
    }

    [Fact]
    public async Task A_person_without_the_schema_right_is_told_so()
    {
        using var site = Site();
        await using var gateway = await GatewayAsync(site);
        var api = new BrowserApi(new HttpClient(gateway.GetTestServer().CreateHandler()) { BaseAddress = new Uri("https://browser.test/") });
        await api.SignInAsync("a.test", "writer", "right");

        var browser = new SchemaBrowserViewModel(api, "a.test");
        await browser.LoadAsync();

        Assert.Contains("schema.read", browser.Error);
        Assert.Empty(browser.Areas);
    }
}
