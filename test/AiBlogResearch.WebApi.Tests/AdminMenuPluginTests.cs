// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Hosting;
using Adventures.Entities;
using Xunit;
using Adventures.Collaboration;

namespace AiBlogResearch.WebApi.Tests;

public class AdminMenuPluginTests
{
    private static readonly string[] AllKeys = [CollaborationPlugins.DeveloperCollaboration, CollaborationPlugins.ResearchCollaboration, CollaborationPlugins.Decisions];

    [Fact]
    public void With_every_plugin_on_the_whole_menu_is_listed()
    {
        Assert.Equal(ComposedMenu.Catalog().All.Count, ComposedMenu.Catalog().Visible(AllKeys.ToHashSet()).Count);
    }

    [Fact]
    public void Decisions_disappears_with_its_plugin()
    {
        var visible = ComposedMenu.Catalog().Visible(AllKeys.Where(k => k != CollaborationPlugins.Decisions).ToHashSet());

        Assert.DoesNotContain(visible, item => item.Id == "decisions");
        Assert.Contains(visible, item => item.Id == "collaboration");
    }

    [Fact]
    public void Collaboration_stays_while_either_kind_is_on_and_goes_when_both_are_off()
    {
        Assert.Contains(ComposedMenu.Catalog().Visible(new HashSet<string> { CollaborationPlugins.ResearchCollaboration }), item => item.Id == "collaboration");
        Assert.DoesNotContain(ComposedMenu.Catalog().Visible(new HashSet<string> { CollaborationPlugins.Decisions }), item => item.Id == "collaboration");
    }

    [Theory]
    [InlineData("blogs")]
    [InlineData("contacts")]
    public void Items_that_are_not_in_the_beta_are_not_listed(string id)
    {
        Assert.DoesNotContain(ComposedMenu.Catalog().All, item => item.Id == id);
    }

    [Fact]
    public void The_plugins_page_itself_is_never_hidden()
    {
        Assert.Contains(ComposedMenu.Catalog().Visible(new HashSet<string>()), item => item.Id == "plugins");
    }

    [Fact]
    public void The_composed_menu_is_the_menu_the_host_used_to_list_itself()
    {
        var user = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity([new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "a")], "test"));
        var rights = new HashSet<string>(Adventures.Entities.Rights.AllNames) { Adventures.Entities.Rights.AdminAccess, Adventures.Entities.Rights.PlatformManage };

        var model = Adventures.WebApi.AdminMenuBuilder.Build(ComposedMenu.Catalog().All, user, null, rights);

        // the legacy BlogEngine groups (DCP, user usage review): Dashboard, Content, then a Collaboration group of our own, Custom, Users, Settings, System (what is new here) and About
        Assert.Equal(
            [
                "Dashboard: dashboard",
                "Content: posts, comments, pages, categories, tags",
                "Collaboration: collaboration, decisions",
                "Custom: plugins, widgets, languages",
                "Users: profile, roles, users",
                "Settings: settings, mail",
                "System: exceptions, maintenance, tenants",
                "About: about",
            ],
            model.Sections.Select(s => $"{s.Id}: {string.Join(", ", s.Items.Select(i => i.Id))}"));
    }
}