using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// F10 (pre-beta structure review): controllers any host would need live in Foundation libraries (Collaboration.WebApi, Diagnostics.WebApi,
/// Identity.WebApi), each registered with one AddXxxControllers() call. The app project keeps only what is its own composition. A ratchet: the
/// list below shrinks as each slice moves; a new controller in the host fails until it is listed on purpose.
/// </summary>
public sealed class ReusableControllersLeaveTheHostTests
{
    private static readonly string[] StillInTheHost =
    [
        "AdminDiagnosticsController", "AdminExceptionsController", "AdminMenuController", "AuthController", "ClientErrorsController", "DashboardController",
        "HealthController", "LookupsController", "M2MAuthController", "McpDiagnosticsController", "ProfileController", "RolesController", "RuntimeController", "TenantController", "UsersController",
    ];

    [Fact]
    public void TheHostProjectDeclaresOnlyTheControllersListedHere()
    {
        var found = typeof(AiBlogResearch.WebApi.Controllers.TenantController).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .Select(t => t.Name)
            .Order(StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(StillInTheHost.Order(StringComparer.Ordinal).ToArray(), found);
    }

    [Fact]
    public void TheDraftScopeOfCollaborationAuthoringIsTheSameAsTheBlogAuthoringScope()
    {
        Assert.Equal(Adventures.Blog.WebApi.AuthoringController.RequiredScope, Adventures.Collaboration.WebApi.CollaborationAuthoringController.RequiredScope);
    }
}
