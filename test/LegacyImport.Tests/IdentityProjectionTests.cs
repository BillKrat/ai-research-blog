using Adventures.Data.NQuad;
using LegacyImport;
using Xunit;

namespace LegacyImport.Tests;

public sealed class IdentityProjectionTests
{
    private static LegacyRowData Row(params (string Name, object? Value)[] values) => new(values.ToDictionary(v => v.Name, v => v.Value));

    private static Dictionary<string, IReadOnlyList<LegacyRowData>> Legacy() => new()
    {
        ["be_Roles"] = [Row(("Role", "Administrators")), Row(("Role", "Editors")), Row(("Role", "Viewers")), Row(("Role", "Anonymous"))],
        ["be_Users"] = [Row(("UserName", "Admin")), Row(("UserName", "Admin")), Row(("UserName", "BillKrat")), Row(("UserName", "Root"))],
        ["be_UserRoles"] =
        [
            Row(("UserName", "Admin"), ("Role", "Administrators")),
            Row(("UserName", "Admin"), ("Role", "Administrators")),   // the same person and role on another blog
            Row(("UserName", "Admin"), ("Role", "Editors")),
            Row(("UserName", "BillKrat"), ("Role", "Admin")),
            Row(("UserName", "Root"), ("Role", "Viewers")),
        ],
        ["be_Rights"] = [Row(("RightName", "CreateNewPosts")), Row(("RightName", "CreateNewPosts")), Row(("RightName", "EditOwnPosts"))],
        ["be_RightRoles"] = [Row(("RightName", "CreateNewPosts"), ("Role", "Editors")), Row(("RightName", "EditOwnPosts"), ("Role", "Editors"))],
    };

    [Fact]
    public void RolesAreMappedByMeaning_AndAnUnknownOrNoCounterpartRoleIsDroppedAndReported()
    {
        var plan = IdentityProjection.Plan(Legacy(), new Dictionary<string, IReadOnlySet<string>>());

        Assert.Equal("Admin", plan.RoleMap["Administrators"]);
        Assert.Equal("Admin", plan.RoleMap["admin"]);
        Assert.Equal("Editor", plan.RoleMap["Editors"]);
        Assert.Equal(["Anonymous", "Viewers"], plan.UnmappedRoles);
        Assert.Equal(2, plan.DistinctRights);
        Assert.Equal(2, plan.RightRoleRows);
    }

    [Fact]
    public void OnlyAPersonWithALiveAccountGetsPlannedAssignments_TheOthersAreCandidatesAndNothingIsCreated()
    {
        var live = new Dictionary<string, IReadOnlySet<string>> { ["admin"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" } };

        var plan = IdentityProjection.Plan(Legacy(), live);

        Assert.Equal(["BillKrat", "Root"], plan.CandidateAccounts);
        Assert.Equal(2, plan.Assignments.Count);                       // the repeated blog row counts once
        Assert.Contains(plan.Assignments, a => a.LiveRole == "Admin" && a.AlreadyAssigned);
        Assert.Contains(plan.Assignments, a => a.LiveRole == "Editor" && !a.AlreadyAssigned);
        Assert.All(IdentityProjection.Describe(plan), line => Assert.DoesNotContain("password", line, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task TheLiveAssignmentsAreReadFromTheSeededQuads()
    {
        var store = new InMemoryNQuadStore();
        var seeds = FindSeeds();
        await store.SeedFromFileAsync(Path.Combine(seeds, "seed.nq"));
        await store.SeedFromFileAsync(Path.Combine(seeds, "seed-004-identity.nq"));

        var live = LiveIdentity.Assignments(await store.QueryAsync());

        Assert.True(live.ContainsKey("Admin"), "the seeded Admin account is found by user name");
        Assert.Contains("Admin", live["Admin"]);
    }

    private static string FindSeeds()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, "Adventures.Foundation", "src", "Adventures.Data.NQuad", "Sql", "seed");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new DirectoryNotFoundException("Adventures.Foundation seed folder not found.");
    }
}
