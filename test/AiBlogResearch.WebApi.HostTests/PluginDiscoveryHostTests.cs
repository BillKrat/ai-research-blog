using Adventures.MEF;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>The real host runs plug-in discovery at start-up: its own libraries compose without a failure, and with no plug-in directory set nothing else is scanned.</summary>
public sealed class PluginDiscoveryHostTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public PluginDiscoveryHostTests(WebApplicationFactory<Program> factory)
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

    [Fact]
    public void TheHostLibraries_ComposeWithoutFailure_AndExportNoPlugin()
    {
        var report = _factory.Services.GetRequiredService<PluginLoadReport>();

        Assert.Empty(report.Failures);
        Assert.Empty(report.Loaded);
    }
}
