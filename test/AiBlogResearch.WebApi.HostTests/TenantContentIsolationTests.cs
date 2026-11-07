using System.Net;
using System.Text.Json;
using Adventures.Blog;
using Adventures.Data.NQuad;
using Adventures.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// T2 through the real pipeline: two tenants on one app and one store. Each public site shows only its own posts, and an address with no tenant is a 404, not
/// another tenant's content. Also guards the map file the relabel tool reads against the host's real registrations.
/// </summary>
public sealed class TenantContentIsolationTests
{
    private sealed class TwoTenants : ITenantResolver
    {
        public Task<CurrentTenant> ResolveAsync(string? host, string? fallbackDomain = null, CancellationToken cancellationToken = default)
        {
            var name = (host ?? string.Empty).Split(':')[0].ToLowerInvariant();
            foreach (var domain in new[] { "acme.test", "other.test" })
            {
                if (name == domain || name.EndsWith("." + domain, StringComparison.Ordinal))
                {
                    return Task.FromResult(new CurrentTenant(domain.Split('.')[0] + "-id", domain, domain, host ?? string.Empty, TenantMatch.Domain));
                }
            }

            return Task.FromResult(new CurrentTenant(null, null, null, host ?? string.Empty, TenantMatch.None));
        }
    }

    private static WebApplicationFactory<Program> Host() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            builder.ConfigureTestServices(services => services.AddScoped<ITenantResolver>(_ => new TwoTenants()));
        });

    private static HttpClient As(WebApplicationFactory<Program> factory, string host)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Host = host;
        return client;
    }

    /// <summary>Writes a published post straight into one tenant's graph, the way the repository does for that tenant's request.</summary>
    private static async Task SeedPostAsync(WebApplicationFactory<Program> factory, string tenantKey, string title)
    {
        var store = factory.Services.GetRequiredService<INQuadStore>();
        var schema = factory.Services.GetRequiredService<EntitySchemaOf<Post>>().Schema;
        var repository = new NQuadEntityRepository<Post>(
            store, schema, BlogConstants.Content.PostBaseIri, BlogConstants.Content.PostTypeIri, BlogConstants.Content.DefaultGraph,
            s => new Post(s), scope: new Fixed(tenantKey));
        var post = new Post(schema);
        var id = Guid.NewGuid().ToString();
        post.Set("Id", id, id);
        post.Set("Title", Guid.NewGuid().ToString(), title);
        post.Set("Slug", Guid.NewGuid().ToString(), title.ToLowerInvariant().Replace(' ', '-'));
        post.Set("IsPublished", Guid.NewGuid().ToString(), true);
        post.Set("DatePublished", Guid.NewGuid().ToString(), DateTimeOffset.UtcNow);
        await repository.CreateAsync(post);
    }

    private sealed class Fixed(string key) : IGraphScope
    {
        public string TenantKey { get; } = key;
    }

    [Fact]
    public async Task EachTenantsPublicSiteShowsOnlyItsOwnPosts_AndAnAddressWithNoTenantIs404()
    {
        using var factory = Host();
        await SeedPostAsync(factory, "acme-id", "Acme only post");
        await SeedPostAsync(factory, "other-id", "Other only post");

        var acme = await As(factory, "api.acme.test").GetStringAsync("/api/public/posts");
        var other = await As(factory, "api.other.test").GetStringAsync("/api/public/posts");
        var nobody = await As(factory, "unbound.example").GetAsync("/api/public/posts");

        Assert.Contains("Acme only post", acme);
        Assert.DoesNotContain("Other only post", acme);
        Assert.Contains("Other only post", other);
        Assert.DoesNotContain("Acme only post", other);
        Assert.Equal(HttpStatusCode.NotFound, nobody.StatusCode);
    }

    [Fact]
    public void TheRelabelToolsMapListsExactlyTheTenantScopedTypesOfTheHost()
    {
        using var factory = Host();
        using var scope = factory.Services.CreateScope();
        var actual = scope.ServiceProvider.GetServices<EntityTypeRegistration>()
            .Where(t => t.TenantScoped)
            .Select(t => (t.BaseIri, t.Graph))
            .OrderBy(t => t.BaseIri, StringComparer.Ordinal)
            .ToList();

        var file = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../docs/Claude-tenant-scoped-types.json"));
        var map = JsonSerializer.Deserialize<List<Entry>>(File.ReadAllText(file), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!
            .Select(e => (e.BaseIri, e.Graph))
            .OrderBy(t => t.BaseIri, StringComparer.Ordinal)
            .ToList();

        Assert.Equal(actual, map);
    }

    private sealed record Entry(string BaseIri, string Graph);
}
