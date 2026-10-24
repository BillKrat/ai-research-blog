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
        new("Dashboard", "dashboard", "Dashboard", "/admin/dashboard", "dashboard", Admin, Available: false, Order: 1),
        new("Content", "posts", "Posts", "/admin/posts", "article", Admin, Order: 1),
        new("Content", "collaboration", "Collaboration", "/admin/collaboration", "forum", Admin, Order: 2),
        new("Content", "comments", "Comments", "/admin/comments", "comment", Admin, Available: false, Order: 8),
        new("Content", "pages", "Pages", "/admin/pages", "description", Admin, Order: 3),
        new("Content", "categories", "Categories", "/admin/categories", "folder", Admin, Order: 4),
        new("Content", "tags", "Tags", "/admin/tags", "sell", Admin, Order: 5),
        new("Content", "blogs", "Blogs", "/admin/blogs", "library_books", Admin, Available: false, Order: 6),
        new("Content", "decisions", "Decisions", "/admin/decisions", "gavel", Admin, Order: 7),
        new("Users", "users", "Users", "/admin/users", "group", Admin, Order: 1),
        new("Users", "roles", "Roles", "/admin/roles", "admin_panel_settings", Admin, Order: 2),
        new("Users", "contacts", "Contacts", "/admin/contacts", "contacts", Admin, Available: false, Order: 3),
        new("System", "exceptions", "Exceptions", "/admin/exceptions", "warning", Admin, Order: 1),
        new("System", "settings", "Settings", "/admin/settings", "settings", Admin, Order: 2),
    ];
}

/// <summary>The admin navigation for the caller (empty for anyone who is not an administrator), with the exceptions count as a badge and, on Posts, the number of Collaboration drafts waiting for review.</summary>
[ApiController]
[Route("api/admin/menu")]
[Authorize]
public sealed class AdminMenuController(IExceptionLogPresenter exceptions, IPublicContent content, ICollaborationBll collaboration) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AdminMenuModel>> Get(CancellationToken cancellationToken)
    {
        var isAdmin = User.IsInRole(AdminMenuDefinitions.Admin)
            || User.FindAll(claim => claim.Type is WellKnownClaims.Roles).Any(claim => claim.Value.Split(' ').Contains(AdminMenuDefinitions.Admin));
        var badges = isAdmin
            ? new Dictionary<string, int>
            {
                ["exceptions"] = await exceptions.CountActiveAsync(cancellationToken),
                // drafts in the Collaboration category: what waits for the human's review
                ["posts"] = await ReviewQueue.CountAsync(content, cancellationToken),
                // collaboration items waiting for the human's review
                ["collaboration"] = await ReviewQueue.CountItemsAsync(collaboration, cancellationToken),
            }
            : null;
        return Ok(AdminMenuBuilder.Build(AdminMenuDefinitions.All, User, badges));
    }
}
