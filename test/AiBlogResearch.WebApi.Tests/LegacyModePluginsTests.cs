using Adventures.Collaboration;
using Adventures.Common.Exceptions;
using Adventures.MEF;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// In the legacy data mode there is no place to store plug-in switches (and no tenant at start-up), so the collaboration plug-ins are simply off and
/// everything else is on, and nothing can be switched. This replaces a start-up step that wrote the "off" state.
/// </summary>
public sealed class LegacyModePluginsTests
{
    private static LegacyModePlugins Plugins() =>
        new([.. CollaborationPlugins.Definitions, new PluginDefinition("html-sanitizer", "HTML sanitising", "d", "1.0.0", 5)]);

    [Fact]
    public async Task TheCollaborationPlugins_AreOff_AndTheOthersAreOn()
    {
        var plugins = Plugins();

        Assert.False(await plugins.IsEnabledAsync(CollaborationPlugins.DeveloperCollaboration));
        Assert.False(await plugins.IsEnabledAsync(CollaborationPlugins.Decisions));
        Assert.True(await plugins.IsEnabledAsync("html-sanitizer"));
        Assert.Equal(["html-sanitizer"], (await plugins.EnabledKeysAsync()).ToArray());
    }

    [Fact]
    public async Task TheList_ShowsEachPluginWithItsFixedState_InPriorityOrder()
    {
        var list = await Plugins().ListAsync();

        Assert.Equal(4, list.Count);
        Assert.Equal(["developer-collaboration", "research-collaboration", "decisions"], list.Where(p => !p.Enabled).Select(p => p.Key));
        Assert.True(list.Single(p => p.Key == "html-sanitizer").Enabled);
        Assert.Equal(list.OrderBy(p => p.Priority).Select(p => p.Key), list.Select(p => p.Key));
    }

    [Fact]
    public async Task NothingCanBeSwitched_InThisMode()
    {
        await Assert.ThrowsAsync<BusinessRuleException>(() => Plugins().SetEnabledAsync("html-sanitizer", false));
        await Assert.ThrowsAsync<BusinessRuleException>(() => Plugins().SetEnabledAsync(CollaborationPlugins.Decisions, true));
    }
}
