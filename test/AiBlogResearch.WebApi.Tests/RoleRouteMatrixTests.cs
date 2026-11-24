using Adventures.Identity.WebApi;
using Adventures.Diagnostics.WebApi;
using Adventures.Collaboration.WebApi;
using System.Reflection;
using Adventures.Entities;
using Adventures.WebApi;
using Adventures.Hosting;
using Microsoft.AspNetCore.Mvc;
using Xunit;

using Adventures.Blog.WebApi;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// S4 route matrix: which right-guarded admin controllers each shipped role can reach (read or any action), derived from the rights written on
/// the routes and the rights each role holds. The rights per role are the same literal sets as Adventures.Entities.Tests/RoleMatrixTests; a person
/// with no role (test-nobody) reaches nothing. Fails when a role gains or loses a screen without the matrix being changed on purpose.
/// </summary>
public sealed class RoleRouteMatrixTests
{
    private static readonly Dictionary<string, string[]> Roles = new()
    {
        ["Admin"] = [.. Rights.Catalog.Select(r => r.Name)],
        ["Editor"] =
        [
            Rights.AdminAccess, Rights.PostsRead, Rights.PostsCreate, Rights.PostsEditAny, Rights.PostsDeleteOwn, Rights.PostsPublish,
            Rights.PagesRead, Rights.PagesEdit, Rights.PagesPublish, Rights.TaxonomyManage, Rights.MediaUpload, Rights.CollaborationRead, Rights.DecisionsRead,
        ],
        ["Reviewer"] = [Rights.AdminAccess, Rights.PostsRead, Rights.PagesRead, Rights.CollaborationRead, Rights.CollaborationWrite, Rights.CollaborationReview, Rights.DecisionsRead],
        ["Developer"] = [Rights.AdminAccess, Rights.PostsRead, Rights.CollaborationRead, Rights.CollaborationWrite, Rights.DiagnosticsRead],
        // The beta tester recipe (backlog, beta readiness): create this role on Admin > Roles. They read and write collaboration items and comment, nothing else.
        ["Beta tester"] = [Rights.AdminAccess, Rights.CollaborationRead, Rights.CollaborationWrite],
        ["(no role)"] = [],
    };

    /// <summary>Per controller, the rights that open any of its routes (the controller-level right, or the read right of an entity controller).</summary>
    private static Dictionary<string, string> EntryRight() =>
        typeof(Adventures.Hosting.RuntimeController).Assembly.GetTypes().Concat(typeof(TenantController).Assembly.GetTypes()).Concat(typeof(AuthoringController).Assembly.GetTypes()).Concat(typeof(CollaborationController).Assembly.GetTypes()).Concat(typeof(HealthController).Assembly.GetTypes())
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .Select(t => (t.Name, Right: t.GetCustomAttribute<RequireRightAttribute>()?.Right ?? t.GetCustomAttribute<AdminRightsAttribute>()?.Read))
            .Where(x => x.Right is not null)
            .ToDictionary(x => x.Name, x => x.Right!);

    private static string[] Reachable(string role)
    {
        var held = Rights.Expand(Roles[role]);
        return EntryRight().Where(p => held.Contains(p.Value)).Select(p => p.Key).Order().ToArray();
    }

    [Fact]
    public void ThereAreRightGuardedScreensToTest()
    {
        Assert.True(EntryRight().Count >= 8, "Expected the admin controllers to be found by their rights.");
    }

    [Fact]
    public void AdminReachesEveryRightGuardedController_AndAPersonWithNoRoleReachesNone()
    {
        Assert.Equal(EntryRight().Keys.Order(), Reachable("Admin"));
        Assert.Empty(Reachable("(no role)"));
    }

    [Theory]
    [InlineData("Editor")]
    [InlineData("Reviewer")]
    [InlineData("Developer")]
    [InlineData("Beta tester")]
    public void NoRoleButAdminReachesPeopleRolesSettingsPluginsOrAnAdminOnlyScreen(string role)
    {
        string[] adminOnly = [nameof(UsersController), nameof(RolesController)];

        Assert.Empty(Reachable(role).Intersect(adminOnly));
    }

    [Fact]
    public void TheDeveloperReachesCollaborationAndDiagnostics_ButNeitherPostsEditingNorPages()
    {
        var reach = Reachable("Developer");

        Assert.Contains(nameof(CollaborationController), reach);
        Assert.DoesNotContain(nameof(PagesController), reach);
    }

    [Fact]
    public void ABetaTesterReachesCollaborationAndNothingElse()
    {
        // every right-guarded admin controller they can open: the collaboration items (their conversation comments are guarded per action by collaboration.write)
        // Dashboard and Lookups open on admin.access but filter inside by rights (Adventures.Blog.WebApi.Tests/DashboardRightsTests, Adventures.Identity.WebApi.Tests/LookupsRightsTests): a beta tester sees no counts and no choices.
        string[] filteredInside = ["DashboardController", "LookupsController"];
        Assert.Equal([nameof(CollaborationController)], Reachable("Beta tester").Except(filteredInside).Order());
    }

    [Fact]
    public void ABetaTesterCannotApproveOrDecide_SoTheyCannotApproveTheirOwnFeedback()
    {
        Assert.DoesNotContain(Rights.CollaborationReview, Rights.Expand(Roles["Beta tester"]));
        Assert.DoesNotContain(Rights.DecisionsRead, Rights.Expand(Roles["Beta tester"]));
        Assert.DoesNotContain(Rights.PostsRead, Rights.Expand(Roles["Beta tester"]));
    }
}