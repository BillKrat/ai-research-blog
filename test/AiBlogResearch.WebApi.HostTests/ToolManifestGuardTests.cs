using Adventures.Tools;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// The tool manifest must not drift from the API it describes: every declared tool names a route that exists with that HTTP method, and the
/// route is guarded by the scope policy the tool names (the API stays the only place that decides). Boots the real host and reads its endpoints.
/// </summary>
public sealed class ToolManifestGuardTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ToolManifestGuardTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Data:Mode", "Legacy");
            builder.UseSetting("ConnectionStrings:LegacySql", "Server=unused;Database=unused;User Id=u;Password=p;TrustServerCertificate=true");
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
        });
    }

    private IReadOnlyList<IAppTool> Tools => _factory.Services.GetRequiredService<ToolCatalog>().All;

    private IReadOnlyList<RouteEndpoint> Endpoints =>
        _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>().ToList();

    [Fact]
    public void The_twenty_one_forwarding_tools_are_declared()
    {
        Assert.Equal(21, Tools.Count);
        Assert.Equal(Tools.Count, Tools.Select(t => t.Name).Distinct().Count());
    }

    [Fact]
    public void Every_tool_maps_to_a_real_route_with_its_method()
    {
        var missing = Tools
            .Where(tool => !Endpoints.Any(e => string.Equals(e.RoutePattern.RawText?.TrimStart('/'), tool.PathTemplate, StringComparison.OrdinalIgnoreCase)
                && (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains(tool.Method, StringComparer.OrdinalIgnoreCase) ?? false)))
            .Select(tool => $"{tool.Name}: {tool.Method} {tool.PathTemplate}")
            .ToList();

        Assert.True(missing.Count == 0, "No such route: " + string.Join("; ", missing));
    }

    [Fact]
    public void Every_tool_route_is_guarded_by_the_scope_the_tool_names()
    {
        var wrong = new List<string>();
        foreach (var tool in Tools)
        {
            var endpoint = Endpoints.First(e => string.Equals(e.RoutePattern.RawText?.TrimStart('/'), tool.PathTemplate, StringComparison.OrdinalIgnoreCase)
                && (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains(tool.Method, StringComparer.OrdinalIgnoreCase) ?? false));
            var policies = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy);
            if (!policies.Contains("Scope:" + tool.RequiredScope))
            {
                wrong.Add($"{tool.Name} needs Scope:{tool.RequiredScope}");
            }
        }

        Assert.True(wrong.Count == 0, string.Join("; ", wrong));
    }

    [Fact]
    public void The_manifest_endpoint_is_served_and_requires_sign_in()
    {
        var endpoint = Endpoints.Single(e => string.Equals(e.RoutePattern.RawText?.TrimStart('/'), "api/tools", StringComparison.OrdinalIgnoreCase));

        Assert.NotEmpty(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>());
    }
}
