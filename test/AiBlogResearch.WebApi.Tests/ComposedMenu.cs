using Adventures.Blog.WebApi;
using Adventures.Collaboration.WebApi;
using Adventures.Diagnostics.WebApi;
using Adventures.Identity.WebApi;
using Adventures.WebApi;
using Microsoft.Extensions.DependencyInjection;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>The admin menu as the host composes it (R3 of the host reuse review): the entries come from the feature libraries the host lists, so tests build the catalog the same way.</summary>
internal static class ComposedMenu
{
    public static ServiceProvider Provider()
    {
        var services = new ServiceCollection();
        services.AddControllers().AddBlogControllers().AddCollaborationControllers().AddDiagnosticsControllers().AddIdentityControllers();
        return services.BuildServiceProvider();
    }

    public static AdminMenuCatalog Catalog() => Provider().GetRequiredService<AdminMenuCatalog>();
}
