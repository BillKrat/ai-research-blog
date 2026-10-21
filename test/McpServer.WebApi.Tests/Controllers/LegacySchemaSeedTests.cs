using Adventures.Data.NQuad;
using Adventures.Entities;
using McpServer.WebApi.BlogAi;
using Xunit;

namespace McpServer.WebApi.Tests.Controllers;

/// <summary>The legacy table list: the single source for the paged row tool and the generated mirror schemas, kept honest by tests.</summary>
public sealed class LegacySchemaSeedTests
{
    private static string SeedPath
    {
        get
        {
            // test assembly folder -> repo root -> sibling Adventures.Foundation
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, "Adventures.Foundation")) && !File.Exists(Path.Combine(directory.FullName, "AiBlogResearch.slnx")))
            {
                directory = directory.Parent;
            }

            var workspace = directory?.Parent?.FullName ?? throw new InvalidOperationException("Workspace root not found.");
            return Path.Combine(workspace, "Adventures.Foundation", "src", "Adventures.Data.NQuad", "Sql", "seed", "seed-009-legacy-schemas.nq");
        }
    }

    [Fact]
    public void TheCheckedInSeed_IsExactlyWhatTheGeneratorProduces()
    {
        var generated = LegacySchemaSeed.Generate(BlogAiTables.All);
        if (Environment.GetEnvironmentVariable("REGENERATE_LEGACY_SEED") == "1")
        {
            File.WriteAllText(SeedPath, generated, new System.Text.UTF8Encoding(false));
        }

        Assert.Equal(generated.Replace("\r\n", "\n"), File.ReadAllText(SeedPath).Replace("\r\n", "\n"));
    }

    [Fact]
    public void EverySchema_LoadsThroughTheRealSchemaLoader_WithAllItsColumns()
    {
        var quads = new NQuadFileParser().Parse(File.ReadAllText(SeedPath));

        foreach (var table in BlogAiTables.All)
        {
            var schema = SchemaDal.Load(quads, LegacySchemaSeed.SchemaBase + table.Name);
            Assert.Equal(table.Columns.Select(c => c.Name), schema.Fields.Values.OrderBy(f => f.Order).Select(f => f.Name));
            Assert.Equal(table.Columns.Select(c => c.Required), schema.Fields.Values.OrderBy(f => f.Order).Select(f => f.IsRequired));
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
