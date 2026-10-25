using AiBlogResearch.WebApi.Controllers;
using Adventures.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

/// <summary>
/// The site is on a tenant's domain and the API on a subdomain of it, so the browser's Origin names the tenant; the API's own Host is the
/// fallback for a direct call. The development fallback domain comes from configuration (Tenancy:FallbackDomain), never from the request.
/// </summary>
public sealed class TenantControllerTests
{
    private sealed class RecordingResolver : ITenantResolver
    {
        public string? Host { get; private set; }
        public string? Fallback { get; private set; }

        public Task<CurrentTenant> ResolveAsync(string? host, string? fallbackDomain = null, CancellationToken cancellationToken = default)
        {
            Host = host;
            Fallback = fallbackDomain;
            return Task.FromResult(new CurrentTenant("t1", "DEV Main", "global-webnet.com", host ?? string.Empty, TenantMatch.Domain));
        }
    }

    private static (TenantController Controller, RecordingResolver Resolver) Build(string requestHost, string? origin = null, string? referer = null, string? fallback = null)
    {
        var resolver = new RecordingResolver();
        var settings = new Dictionary<string, string?> { ["Tenancy:FallbackDomain"] = fallback };
        var controller = new TenantController(resolver, new ConfigurationBuilder().AddInMemoryCollection(settings).Build());
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString(requestHost);
        if (origin is not null)
        {
            context.Request.Headers.Origin = origin;
        }

        if (referer is not null)
        {
            context.Request.Headers.Referer = referer;
        }

        controller.ControllerContext = new ControllerContext { HttpContext = context };
        return (controller, resolver);
    }

    [Fact]
    public async Task TheBrowsersOriginNamesTheTenant_NotTheApiHost()
    {
        var (controller, resolver) = Build("api.global-webnet.com", origin: "https://www.adventuresedge.net");

        var result = await controller.Current(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("www.adventuresedge.net", resolver.Host);
    }

    [Fact]
    public async Task WithoutAnOrigin_TheRefererIsUsed_ThenTheRequestHost()
    {
        var (withReferer, resolverA) = Build("api.global-webnet.com", referer: "https://adventuresedge.net/admin/users");
        await withReferer.Current(CancellationToken.None);
        Assert.Equal("adventuresedge.net", resolverA.Host);

        var (direct, resolverB) = Build("api.global-webnet.com");
        await direct.Current(CancellationToken.None);
        Assert.Equal("api.global-webnet.com", resolverB.Host);
    }

    [Fact]
    public async Task AMalformedOriginIsIgnored_AndTheDevelopmentFallbackComesFromConfigurationOnly()
    {
        var (controller, resolver) = Build("localhost:7052", origin: "not a url", fallback: "global-webnet.com");

        await controller.Current(CancellationToken.None);

        Assert.Equal("localhost:7052", resolver.Host);
        Assert.Equal("global-webnet.com", resolver.Fallback);
    }
}
