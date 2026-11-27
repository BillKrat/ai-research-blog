using System.Text.RegularExpressions;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// R6 of the host reuse review: the ratchet that keeps the hosts thin. A host names features and settings; the generic composition lives in Foundation. The budgets are
/// today's sizes plus a small margin and may only be lowered; a host that needs more has code that belongs in a library. Each host lists the store projects it chooses
/// (a host picks its store; a feature library or the MCP gateway never does), and no host may declare a type that the shared libraries now own.
/// </summary>
public sealed class ThinHostRatchetTests
{
    public static TheoryData<string, int, string> Budgets => new()
    {
        { "AiBlogResearch.WebApi", 30, "Adventures.Blog.Legacy" }, // only for LegacySeeds; the store choice lives in Adventures.Hosting
        { "McpServer.WebApi", 60, "" },
    };

    private static readonly string[] StoreProjects =
    [
        "Adventures.Data.NQuad", "Adventures.Data.NQuad.Postgres", "Adventures.Data.Postgres", "Adventures.Data.Sql",
        "Adventures.Blog.Postgres", "Adventures.Identity.Postgres", "Adventures.Blog.Legacy",
    ];

    /// <summary>Types that moved to the shared libraries in R1 to R5; a host that declares one again has started a copy.</summary>
    private static readonly string[] MovedTypes =
    [
        "StartupChecks", "LiveDataMode", "SeedProfile", "ClientSite", "StartupSeeds", "AppStartupUpgrades", "AppLogging", "AppAssemblies",
        "McpController", "DiagnosticsApiClient", "DiagnosticsController", "AdminMenuController", "AdminMenuDefinitions", "DashboardController", "ReviewQueue",
        "BlogAiReader", "BlogAiTables", "LegacySchemaSeed", "SecurityHeaders",
    ];

    private static string HostFolder(string host)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "src", host);
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new DirectoryNotFoundException(host);
    }

    private static IEnumerable<string> SourceFiles(string host) =>
        Directory.GetFiles(HostFolder(host), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"));

    [Theory]
    [MemberData(nameof(Budgets))]
    public void A_host_stays_under_its_line_budget(string host, int budget, string _)
    {
        var lines = SourceFiles(host).Sum(f => File.ReadLines(f).Count());
        Assert.True(lines <= budget, $"{host} is {lines} lines, over its budget of {budget}: move the generic part into a Foundation library (and lower a budget, never raise one).");
    }

    [Theory]
    [MemberData(nameof(Budgets))]
    public void A_host_references_only_the_store_projects_it_lists(string host, int _, string allowedStores)
    {
        var csproj = File.ReadAllText(Path.Combine(HostFolder(host), host + ".csproj"));
        var stores = Regex.Matches(csproj, "<ProjectReference Include=\"([^\"]+)\"")
            .Select(m => Path.GetFileNameWithoutExtension(m.Groups[1].Value.Replace('\\', '/')))
            .Where(StoreProjects.Contains)
            .OrderBy(n => n, StringComparer.Ordinal)
            .ToList();

        Assert.Equal(allowedStores.Split(',', StringSplitOptions.RemoveEmptyEntries).OrderBy(n => n, StringComparer.Ordinal), stores);
    }

    [Theory]
    [MemberData(nameof(Budgets))]
    public void A_host_declares_none_of_the_types_the_shared_libraries_own(string host, int _, string __)
    {
        var declared = SourceFiles(host)
            .SelectMany(f => Regex.Matches(File.ReadAllText(f), @"\b(?:class|record|interface|struct)\s+([A-Za-z_][A-Za-z0-9_]*)").Select(m => m.Groups[1].Value))
            .Where(MovedTypes.Contains)
            .ToList();

        Assert.Empty(declared);
    }
}
