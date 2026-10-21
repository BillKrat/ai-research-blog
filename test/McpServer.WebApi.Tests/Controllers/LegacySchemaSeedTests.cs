using Adventures.Data.NQuad;
using Adventures.Entities;
using McpServer.WebApi.BlogAi;
using Xunit;

namespace McpServer.WebApi.Tests.Controllers;

/// <summary>The legacy table list: the single source for the paged row tool and the generated mirror schemas, kept honest by tests.</summary>
public sealed class LegacySchemaSeedTests
{
    private static string SeedPath(string file)
    {
        // test assembly folder -> repo root -> sibling Adventures.Foundation
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, "Adventures.Foundation")) && !File.Exists(Path.Combine(directory.FullName, "AiBlogResearch.slnx")))
        {
            directory = directory.Parent;
        }

        var workspace = directory?.Parent?.FullName ?? throw new InvalidOperationException("Workspace root not found.");
        return Path.Combine(workspace, "Adventures.Foundation", "src", "Adventures.Data.NQuad", "Sql", "seed", file);
    }

    private const string ColumnsSeed = "seed-009-legacy-schemas.nq";
    private const string IdFieldsSeed = "seed-010-legacy-ids.nq";

    private static void AssertSeedMatches(string file, string generated)
    {
        if (Environment.GetEnvironmentVariable("REGENERATE_LEGACY_SEED") == "1")
        {
            File.WriteAllText(SeedPath(file), generated, new System.Text.UTF8Encoding(false));
        }

        Assert.Equal(generated.Replace("\r\n", "\n"), File.ReadAllText(SeedPath(file)).Replace("\r\n", "\n"));
    }

    [Fact]
    public void TheCheckedInSeeds_AreExactlyWhatTheGeneratorProduces() =>
        AssertSeedMatches(ColumnsSeed, LegacySchemaSeed.Generate(BlogAiTables.All));

    [Fact]
    public void TheIdFieldsSeed_IsExactlyWhatTheGeneratorProduces() =>
        AssertSeedMatches(IdFieldsSeed, LegacySchemaSeed.GenerateIdFields(BlogAiTables.All));

    [Fact]
    public void EverySchema_LoadsThroughTheRealSchemaLoader_WithAnIdAndAllItsColumns()
    {
        // both seeds, in the order the app applies them
        var quads = new NQuadFileParser().Parse(File.ReadAllText(SeedPath(ColumnsSeed)) + File.ReadAllText(SeedPath(IdFieldsSeed)));

        foreach (var table in BlogAiTables.All)
        {
            var schema = SchemaDal.Load(quads, LegacySchemaSeed.SchemaBase + table.Name);
            var fields = schema.Fields.Values.OrderBy(f => f.Order).ToList();
            Assert.Equal(["Id", .. table.Columns.Select(c => c.Name)], fields.Select(f => f.Name));
            Assert.Equal(table.Columns.Select(c => c.Required), fields.Skip(1).Select(f => f.IsRequired));
            Assert.Equal("Guid", fields[0].Type);
        }
    }

    [Fact]
    public void Tables_HaveUniqueNames_AnIdentityColumnFirst_AndNoSecretOrBinaryColumn()
    {
        Assert.Equal(BlogAiTables.All.Count, BlogAiTables.All.Select(t => t.Name).Distinct().Count());
        Assert.All(BlogAiTables.All, t =>
        {
            Assert.StartsWith("be_", t.Name);
            Assert.Contains(t.Columns[0].Name, new[] { "BlogRowId", "UserID", "RoleID", "UserRoleID", "RightRowId", "RightRoleRowId", "ProfileID", "PostRowID", "PageRowID", "CategoryRowID", "PostCategoryID", "PostTagID" });
            Assert.Equal(t.Columns.Count, t.Columns.Select(c => c.Name).Distinct().Count());
            Assert.DoesNotContain(t.Columns, c => c.Name is "Password" or "Comment" or "Contents");
        });
    }

    [Fact]
    public void PageSql_NamesOnlyListedColumns_AndPagesWithParameters()
    {
        var sql = BlogAiTables.PageSql(BlogAiTables.Find("be_Users")!);

        Assert.Equal("SELECT [UserID], [BlogID], [UserName], [LastLoginTime], [EmailAddress] FROM dbo.[be_Users] ORDER BY [UserID] OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY", sql);
        Assert.DoesNotContain("Password", sql);
    }

    [Fact]
    public void LegacyConstants_MatchTheGenerator()
    {
        Assert.Equal(LegacySchemaSeed.SchemaBase, EntityConstants.Legacy.SchemaBase);
        Assert.Equal(LegacySchemaSeed.Graph, EntityConstants.Legacy.DefaultGraph);
    }
}
