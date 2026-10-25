// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// What this app admin menu holds. The destination (BlogEngine admin: Dashboard, Content, Users, ...) is listed from the
/// start; screens that do not exist yet are declared <c>Available: false</c>, so the menu shows where the work is heading and
/// each slice only flips a flag and gives the item a route.
/// </summary>
public static class AdminMenuDefinitions
{
    public const string Admin = WellKnownClaims.TenantAdminRole;

    public static readonly IReadOnlyList<AdminMenuItemDefinition> All =
    [
        new("Dashboard", "dashboard", "Dashboard", "/admin/dashboard", "dashboard", RequiredRight: Rights.AdminAccess, Available: false, Order: 1),
        new("Content", "posts", "Posts", "/admin/posts", "article", RequiredRight: Rights.PostsRead, Order: 1),
        new("Content", "collaboration", "Collaboration", "/admin/collaboration", "forum", RequiredRight: Rights.CollaborationRead, Order: 2),
        new("Content", "comments", "Comments", "/admin/comments", "comment", RequiredRight: Rights.PostsRead, Available: false, Order: 8),
        new("Content", "pages", "Pages", "/admin/pages", "description", RequiredRight: Rights.PagesRead, Order: 3),
        new("Content", "categories", "Categories", "/admin/categories", "folder", RequiredRight: Rights.PostsRead, Order: 4),
        new("Content", "tags", "Tags", "/admin/tags", "sell", RequiredRight: Rights.PostsRead, Order: 5),
        new("Content", "blogs", "Blogs", "/admin/blogs", "library_books", RequiredRight: Rights.PostsRead, Available: false, Order: 6),
        new("Content", "decisions", "Decisions", "/admin/decisions", "gavel", RequiredRight: Rights.DecisionsRead, Order: 7),
        new("Users", "users", "Users", "/admin/users", "group", RequiredRight: Rights.UsersManage, Order: 1),
        new("Users", "roles", "Roles", "/admin/roles", "admin_panel_settings", RequiredRight: Rights.RolesManage, Order: 2),
        new("Users", "contacts", "Contacts", "/admin/contacts", "contacts", RequiredRight: Rights.UsersManage, Available: false, Order: 3),
        new("System", "exceptions", "Exceptions", "/admin/exceptions", "warning", RequiredRight: Rights.DiagnosticsRead, Order: 1),
        new("System", "settings", "Settings", "/admin/settings", "settings", RequiredRight: Rights.SettingsManage, Order: 2),
        new("System", "plugins", "Plugins", "/admin/plugins", "extension", RequiredRight: Rights.PluginsManage, Order: 3),
    ];

    /// <summary>The menu entries a plug-in contributes: the entry is listed only while one of its plug-ins is on.</summary>
    private static readonly IReadOnlyDictionary<string, string[]> ContributedBy = new Dictionary<string, string[]>
    {
        ["collaboration"] = [PluginCatalog.DeveloperCollaboration, PluginCatalog.ResearchCollaboration],
        ["decisions"] = [PluginCatalog.Decisions],
    };

    /// <summary>The definitions without the entries of plug-ins that are switched off.</summary>
    public static IReadOnlyList<AdminMenuItemDefinition> Visible(IReadOnlySet<string> enabledPlugins) =>
        All.Where(item => !ContributedBy.TryGetValue(item.Id, out var keys) || keys.Any(enabledPlugins.Contains)).ToList();
}

/// <summary>The admin navigation for the caller (empty for anyone who is not an administrator), with the exceptions count as a badge and, on Posts, the number of Collaboration drafts waiting for review.</summary>
[ApiController]
[Route("api/admin/menu")]
[Authorize]
public sealed class AdminMenuController(IExceptionLogPresenter exceptions, IPublicContent content, ICollaborationBll collaboration, IPlugins plugins, IRightsAuthorizer authorizer) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AdminMenuModel>> Get(CancellationToken cancellationToken)
    {
        var rights = await authorizer.RightsOfAsync(User, cancellationToken);
        var badges = rights.Contains(Rights.AdminAccess)
            ? new Dictionary<string, int>
            {
                ["exceptions"] = await exceptions.CountActiveAsync(cancellationToken),
                // drafts in the Collaboration category: what waits for the human's review
                ["posts"] = await ReviewQueue.CountAsync(content, cancellationToken),
                // collaboration items waiting for the human's review
                ["collaboration"] = await ReviewQueue.CountItemsAsync(collaboration, cancellationToken),
            }
            : null;
        return Ok(AdminMenuBuilder.Build(AdminMenuDefinitions.Visible(await plugins.EnabledKeysAsync(cancellationToken)), User, badges, rights));
    }
}
