using AiBlogResearch.WebApi.Controllers;
using Adventures.Entities;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

public class AdminMenuPluginTests
{
    private static readonly string[] AllKeys = [PluginCatalog.DeveloperCollaboration, PluginCatalog.ResearchCollaboration, PluginCatalog.Decisions];

    [Fact]
    public void With_every_plugin_on_the_whole_menu_is_listed()
    {
        Assert.Equal(AdminMenuDefinitions.All.Count, AdminMenuDefinitions.Visible(AllKeys.ToHashSet()).Count);
    }

    [Fact]
    public void Decisions_disappears_with_its_plugin()
    {
        var visible = AdminMenuDefinitions.Visible(AllKeys.Where(k => k != PluginCatalog.Decisions).ToHashSet());

        Assert.DoesNotContain(visible, item => item.Id == "decisions");
        Assert.Contains(visible, item => item.Id == "collaboration");
    }

    [Fact]
    public void Collaboration_stays_while_either_kind_is_on_and_goes_when_both_are_off()
    {
        Assert.Contains(AdminMenuDefinitions.Visible(new HashSet<string> { PluginCatalog.ResearchCollaboration }), item => item.Id == "collaboration");
        Assert.DoesNotContain(AdminMenuDefinitions.Visible(new HashSet<string> { PluginCatalog.Decisions }), item => item.Id == "collaboration");
    }

    [Fact]
    public void The_plugins_page_itself_is_never_hidden()
    {
        Assert.Contains(AdminMenuDefinitions.Visible(new HashSet<string>()), item => item.Id == "plugins");
    }
}
