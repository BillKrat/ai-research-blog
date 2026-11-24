using System.Security.Claims;
using Adventures.Blog;
using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Adventures.Blog;
using Adventures.Blog.WebApi;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>The admin menu names (sections and entries) are server text: each is declared with its English name and passes through the standard localizer.</summary>
public sealed class AdminMenuLocalizationTests
{
    private sealed class TableLocalizer(Dictionary<string, string> table) : IStringLocalizer
    {
        public LocalizedString this[string name] => table.TryGetValue(name, out var v) ? new(name, v) : new(name, name, resourceNotFound: true);

        public LocalizedString this[string name, params object[] arguments] => this[name];

        public IEnumerable<LocalizedString> GetAllStrings(bool includeParentCultures) => [];
    }

    private static AdminMenuModel Menu()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "a")], "test"));
        var rights = new HashSet<string>(Rights.AllNames) { Rights.AdminAccess };
        return AdminMenuBuilder.Build(ComposedMenu.Catalog().All, user, null, rights);
    }

    [Fact]
    public void EveryMenuNameIsDeclaredWithItsEnglishText_SoTheLanguageScreenCanListIt()
    {
        var catalog = ComposedMenu.Catalog();
        var declared = ComposedMenu.Provider().GetServices<IServerTextSource>().SelectMany(s => s.Declarations).ToDictionary(d => d.Key, d => d.English);

        foreach (var item in catalog.All)
        {
            Assert.Equal(item.Label, declared[$"menu.{item.Id}"]);
            Assert.Equal(item.Section, declared[$"menu.section.{item.Section}"]);
        }
    }

    [Fact]
    public void LocalizingTheMenu_ReplacesTheNamesThatHaveATranslation_AndKeepsTheRest()
    {
        var localizer = new TableLocalizer(new() { ["menu.dashboard"] = "Übersicht", ["menu.section.Content"] = "Inhalt" });

        var localized = AdminMenuLocalization.Localize(Menu(), localizer);

        Assert.Equal("Inhalt", localized.Sections.Single(s => s.Id == "Content").Label);
        Assert.Equal("System", localized.Sections.Single(s => s.Id == "System").Label);   // no German text: unchanged
        Assert.Equal("Übersicht", localized.Sections.SelectMany(s => s.Items).Single(i => i.Id == "dashboard").Label);
        Assert.Equal("Posts", localized.Sections.SelectMany(s => s.Items).Single(i => i.Id == "posts").Label);
    }

    [Fact]
    public void LocalizingKeepsEverythingButTheNames_IdsRoutesIconsAndBadges()
    {
        var before = Menu();

        var after = AdminMenuLocalization.Localize(before, new TableLocalizer(new() { ["menu.posts"] = "Beiträge" }));

        Assert.Equal(before.Sections.Select(s => s.Id), after.Sections.Select(s => s.Id));
        Assert.Equal(before.Sections.SelectMany(s => s.Items).Select(i => (i.Id, i.Route, i.Icon, i.Available, i.Badge)), after.Sections.SelectMany(s => s.Items).Select(i => (i.Id, i.Route, i.Icon, i.Available, i.Badge)));
    }
}
