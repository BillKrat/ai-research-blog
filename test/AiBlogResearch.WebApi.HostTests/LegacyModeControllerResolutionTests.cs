using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// Data:Mode=Legacy swaps registrations only, so every controller must still be constructible from the container. Found by a Legacy run: Admin > Users
/// returned 500 because the Legacy branch skipped the identity registrations UsersController needs. Boots the real host in Legacy mode (the SQL
/// connection is never opened by resolving a controller) and builds every controller the way MVC does.
/// </summary>
public sealed class LegacyModeControllerResolutionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public LegacyModeControllerResolutionTests(WebApplicationFactory<Program> factory)
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
    public void Every_controller_can_be_constructed_in_Legacy_mode()
    {
        var feature = new ControllerFeature();
        _factory.Services.GetRequiredService<ApplicationPartManager>().PopulateFeature(feature);
        Assert.NotEmpty(feature.Controllers);

        using var scope = _factory.Services.CreateScope();
        var failures = new List<string>();
        foreach (var controller in feature.Controllers)
        {
            try
            {
                ActivatorUtilities.CreateInstance(scope.ServiceProvider, controller.AsType());
            }
            catch (InvalidOperationException error)
            {
                failures.Add($"{controller.Name}: {error.Message}");
            }
        }

        Assert.True(failures.Count == 0, string.Join(Environment.NewLine, failures));
    }
}
