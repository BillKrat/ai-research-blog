// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Adventures.Blog;
using Adventures.Collaboration;
using Adventures.MEF;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;

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
        new("Dashboard", "dashboard", "Dashboard", "/admin/dashboard", "dashboard", RequiredRight: Rights.AdminAccess, Order: 1),
        new("Content", "posts", "Posts", "/admin/posts", "article", RequiredRight: Rights.PostsRead, Order: 1),
        new("Content", "collaboration", "Collaboration", "/admin/collaboration", "forum", RequiredRight: Rights.CollaborationRead, Order: 2),
        new("Content", "comments", "Comments", "/admin/comments", "comment", RequiredRight: Rights.CommentsModerate, Order: 6),
        new("Content", "pages", "Pages", "/admin/pages", "description", RequiredRight: Rights.PagesRead, Order: 3),
        new("Content", "categories", "Categories", "/admin/categories", "folder", RequiredRight: Rights.PostsRead, Order: 4),
        new("Content", "tags", "Tags", "/admin/tags", "sell", RequiredRight: Rights.PostsRead, Order: 5),
        new("Content", "decisions", "Decisions", "/admin/decisions", "gavel", RequiredRight: Rights.DecisionsRead, Order: 7),
        new("Users", "users", "Users", "/admin/users", "group", RequiredRight: Rights.UsersManage, Order: 1),
        new("Users", "roles", "Roles", "/admin/roles", "admin_panel_settings", RequiredRight: Rights.RolesManage, Order: 2),
        new("System", "exceptions", "Exceptions", "/admin/exceptions", "warning", RequiredRight: Rights.DiagnosticsRead, Order: 1),
        new("System", "settings", "Settings", "/admin/settings", "settings", RequiredRight: Rights.SettingsManage, Order: 2),
        new("System", "plugins", "Plugins", "/admin/plugins", "extension", RequiredRight: Rights.PluginsManage, Order: 3),
        new("System", "mail", "E-mail", "/admin/plugins/mail", "mail", RequiredRight: Rights.PluginsManage, Order: 4),
        new("System", "widgets", "Widgets", "/admin/widgets", "widgets", RequiredRight: Rights.SettingsManage, Order: 5),
        new("System", "languages", "Languages", "/admin/languages", "translate", RequiredRight: Rights.SettingsManage, Order: 6),
        new("System", "tenants", "Tenants", "/admin/tenants", "domain", RequiredRight: Rights.PlatformManage, Order: 7),
    ];

    /// <summary>Declares the English name of every section and entry as server text (keys <c>menu.section.&lt;Section&gt;</c> and <c>menu.&lt;id&gt;</c>), so a language file can translate them.</summary>
    public static IServiceCollection DeclareTexts(IServiceCollection services)
    {
        foreach (var item in All)
        {
            services.AddServerText($"menu.{item.Id}", item.Label);
        }

        foreach (var section in All.Select(item => item.Section).Distinct(StringComparer.Ordinal))
        {
            services.AddServerText($"menu.section.{section}", section);
        }

        return services;
    }

    /// <summary>The menu with its section and entry names in the site language; a name with no translation keeps its English text.</summary>
    public static AdminMenuModel Localize(AdminMenuModel menu, IStringLocalizer text) =>
        menu with
        {
            Sections = menu.Sections
                .Select(section => section with
                {
                    Label = Pick(text, $"menu.section.{section.Id}", section.Label),
                    Items = section.Items.Select(item => item with { Label = Pick(text, $"menu.{item.Id}", item.Label) }).ToList(),
                })
                .ToList(),
        };

    private static string Pick(IStringLocalizer text, string key, string english)
    {
        var found = text[key];
        return found.ResourceNotFound ? english : found.Value;
    }

    /// <summary>The menu entries a plug-in contributes: the entry is listed only while one of its plug-ins is on.</summary>
    private static readonly IReadOnlyDictionary<string, string[]> ContributedBy = new Dictionary<string, string[]>
    {
        ["collaboration"] = [CollaborationPlugins.DeveloperCollaboration, CollaborationPlugins.ResearchCollaboration],
        ["decisions"] = [CollaborationPlugins.Decisions],
    };

    /// <summary>The definitions without the entries of plug-ins that are switched off.</summary>
    public static IReadOnlyList<AdminMenuItemDefinition> Visible(IReadOnlySet<string> enabledPlugins) =>
        All.Where(item => !ContributedBy.TryGetValue(item.Id, out var keys) || keys.Any(enabledPlugins.Contains)).ToList();
}

/// <summary>The admin navigation for the caller (empty for anyone who is not an administrator), with the exceptions count as a badge and, on Posts, the number of Collaboration drafts waiting for review.</summary>
[ApiController]
[Route("api/admin/menu")]
[Authorize]
public sealed class AdminMenuController(IExceptionLogPresenter exceptions, IPublicContent content, ICollaborationBll collaboration, IPlugins plugins, IRightsAuthorizer authorizer, IVisitorComments comments, IRequestLanguage language, IStringLocalizer text) : ControllerBase
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
                // visitor comments waiting for approval
                ["comments"] = await comments.CountPendingAsync(cancellationToken),
            }
            : null;
        await language.LoadAsync(cancellationToken);
        return Ok(AdminMenuDefinitions.Localize(AdminMenuBuilder.Build(AdminMenuDefinitions.Visible(await plugins.EnabledKeysAsync(cancellationToken)), User, badges, rights), text));
    }
}
