using Adventures.Data.NQuad;
using Adventures.Entities;
using LegacyImport;
using McpServer.WebApi.BlogAi;
using Xunit;

namespace LegacyImport.Tests;

public sealed class ImportTests
{
    private static string SeedDirectory
    {
        get
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

    private static async Task<InMemoryNQuadStore> SeededStoreAsync()
    {
        var store = new InMemoryNQuadStore();
        foreach (var seed in new[] { "seed.nq", "seed-006-content.nq", "seed-007-post-taxonomy.nq", "seed-008-post-revision.nq", "seed-009-legacy-schemas.nq", "seed-010-legacy-ids.nq" })
        {
            await store.SeedFromFileAsync(Path.Combine(SeedDirectory, seed));
        }

        return store;
    }

    private static readonly Guid Blog = Guid.Parse("27604f05-86ad-47ef-9e05-950bb762570c");

    private static LegacyRowData Row(params (string Name, object? Value)[] values) => new(values.ToDictionary(v => v.Name, v => v.Value));

    private static LegacyRowData Post(Guid id, string slug, bool published = true, bool deleted = false, string html = "<p>Hi</p>") => Row(
        ("PostRowID", 1), ("BlogID", Blog), ("PostID", id), ("Title", "Title " + slug), ("Description", "d"), ("PostContent", html),
        ("DateCreated", new DateTimeOffset(2025, 2, 13, 2, 4, 0, TimeSpan.Zero)), ("DateModified", null), ("Author", "BillKrat"), ("IsPublished", published),
        ("IsCommentEnabled", true), ("Raters", 0), ("Rating", 0.0), ("Slug", slug), ("IsDeleted", deleted));

    [Fact]
    public void Version5Ids_MatchTheRfcExample()
    {
        var dns = Guid.Parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");

        Assert.Equal(Guid.Parse("2ed6657d-e927-568b-95e1-2665a8aea6a2"), LegacyIds.Version5(dns, "www.example.com"));
        Assert.Equal(LegacyIds.ForTagName("Blog"), LegacyIds.ForTagName(" blog "));
        Assert.NotEqual(LegacyIds.ForTagName("Blog"), LegacyIds.ForCategoryName("Blog"));
    }

    [Fact]
    public async Task Mirror_CreatesRowsFieldForField_AndAReRunChangesNothing()
    {
        var store = await SeededStoreAsync();
        var table = BlogAiTables.Find("be_Posts")!;
        var schema = SchemaDal.Load(await store.QueryAsync(), LegacySchemaSeed.SchemaBase + "be_Posts");
        var repository = MirrorImporter.Repository(store, schema, "be_Posts");
        var id = Guid.NewGuid();
        var rows = new[] { Post(id, "one"), Post(Guid.NewGuid(), "two") };

        var first = await MirrorImporter.ImportAsync(table, rows, schema, repository, apply: true, CancellationToken.None);
        var second = await MirrorImporter.ImportAsync(table, rows, schema, repository, apply: true, CancellationToken.None);

        Assert.Equal((2, 2, 0, 0, 0), (first.Read, first.Created, first.Updated, first.Unchanged, first.Mismatches));
        Assert.Equal((2, 0, 0, 2, 0), (second.Read, second.Created, second.Updated, second.Unchanged, second.Mismatches));
        var stored = await repository.GetAsync(id.ToString());
        Assert.Equal("Title one", stored!.GetValue("Title"));
        Assert.Equal(new DateTimeOffset(2025, 2, 13, 2, 4, 0, TimeSpan.Zero), ((DateTimeOffset)stored.GetValue("DateCreated")!).ToUniversalTime());
        Assert.Null(stored.GetValue("DateModified"));
        Assert.Equal(true, stored.GetValue("IsPublished"));
    }

    [Fact]
    public async Task Mirror_ADryRunWritesNothing_AndAChangedColumnSupersedesTheOldValue()
    {
        var store = await SeededStoreAsync();
        var table = BlogAiTables.Find("be_Posts")!;
        var schema = SchemaDal.Load(await store.QueryAsync(), LegacySchemaSeed.SchemaBase + "be_Posts");
        var repository = MirrorImporter.Repository(store, schema, "be_Posts");
        var id = Guid.NewGuid();

        var dry = await MirrorImporter.ImportAsync(table, [Post(id, "one")], schema, repository, apply: false, CancellationToken.None);
        Assert.Equal(1, dry.Created);
        Assert.Null(await repository.GetAsync(id.ToString()));

        await MirrorImporter.ImportAsync(table, [Post(id, "one")], schema, repository, apply: true, CancellationToken.None);
        var changed = Post(id, "one-renamed");
        var update = await MirrorImporter.ImportAsync(table, [changed], schema, repository, apply: true, CancellationToken.None);

        Assert.Equal((0, 1, 0), (update.Created, update.Updated, update.Mismatches));
        Assert.Equal("one-renamed", (await repository.GetAsync(id.ToString()))!.GetValue("Slug"));
    }

    [Fact]
    public async Task Mirror_RowsWithoutAGuid_GetAStableDerivedId()
    {
        var store = await SeededStoreAsync();
        var table = BlogAiTables.Find("be_Roles")!;
        var schema = SchemaDal.Load(await store.QueryAsync(), LegacySchemaSeed.SchemaBase + "be_Roles");
        var repository = MirrorImporter.Repository(store, schema, "be_Roles");
        var rows = new[] { Row(("RoleID", 7), ("BlogID", Blog), ("Role", "Editors")) };

        await MirrorImporter.ImportAsync(table, rows, schema, repository, apply: true, CancellationToken.None);

        Assert.NotNull(await repository.GetAsync(LegacyIds.Derive("be_Roles:7").ToString()));
    }

    private sealed class FakeConverter : IMarkdownConverter
    {
        public string Convert(string html, string slug) => $"MD[{slug}]:{html}";
    }

    private static async Task<(InMemoryNQuadStore Store, ProjectionResult Result, NQuadEntityRepository<Post> Posts, NQuadEntityRepository<Category> Categories, NQuadEntityRepository<Tag> Tags, NQuadEntityRepository<Page> Pages)> ProjectAsync(
        InMemoryNQuadStore store, IReadOnlyDictionary<string, IReadOnlyList<LegacyRowData>> tables, bool apply)
    {
        var quads = await store.QueryAsync();
        EntitySchema Live(string iri) => SchemaDal.Load(quads, iri);
        NQuadEntityRepository<T> Repo<T>(string schemaIri, string baseIri, string typeIri, Func<EntitySchema, T> factory) where T : DynamicEntity =>
            new(store, Live(schemaIri), baseIri, typeIri, EntityConstants.Content.DefaultGraph, factory, changedBy: "legacy-import");

        var categories = Repo(EntityConstants.Content.CategorySchemaIri, EntityConstants.Content.CategoryBaseIri, EntityConstants.Content.CategoryTypeIri, s => new Category(s));
        var tags = Repo(EntityConstants.Content.TagSchemaIri, EntityConstants.Content.TagBaseIri, EntityConstants.Content.TagTypeIri, s => new Tag(s));
        var pages = Repo(EntityConstants.Content.PageSchemaIri, EntityConstants.Content.PageBaseIri, EntityConstants.Content.PageTypeIri, s => new Page(s));
        var posts = Repo(EntityConstants.Content.PostSchemaIri, EntityConstants.Content.PostBaseIri, EntityConstants.Content.PostTypeIri, s => new Post(s));
        var result = await ContentProjection.ProjectAsync(
            tables, categories, tags, pages, posts,
            Live(EntityConstants.Content.CategorySchemaIri), Live(EntityConstants.Content.TagSchemaIri), Live(EntityConstants.Content.PageSchemaIri), Live(EntityConstants.Content.PostSchemaIri),
            new FakeConverter(), ["skipped-post"], ["disclaimer"], apply, CancellationToken.None);
        return (store, result, posts, categories, tags, pages);
    }

    private static IReadOnlyDictionary<string, IReadOnlyList<LegacyRowData>> Tables(Guid published, Guid draft, Guid deleted, Guid skipped, Guid general1, Guid general2, Guid mcp, Guid disclaimer, Guid stub) =>
        new Dictionary<string, IReadOnlyList<LegacyRowData>>
        {
            ["be_Posts"] = [Post(published, "published-post", html: "<p>x</p>"), Post(draft, "legacy-draft", published: false), Post(deleted, "gone", deleted: true), Post(skipped, "skipped-post")],
            ["be_Categories"] =
            [
                Row(("CategoryRowID", 1), ("BlogID", Blog), ("CategoryID", general1), ("CategoryName", "General"), ("Description", "General topics"), ("ParentID", null)),
                Row(("CategoryRowID", 2), ("BlogID", Guid.NewGuid()), ("CategoryID", general2), ("CategoryName", "general"), ("Description", "General topics"), ("ParentID", null)),
                Row(("CategoryRowID", 3), ("BlogID", Blog), ("CategoryID", mcp), ("CategoryName", "MCP Bridge"), ("Description", null), ("ParentID", null)),
            ],
            ["be_PostCategory"] = [Row(("PostCategoryID", 1), ("BlogID", Blog), ("PostID", published), ("CategoryID", general2)), Row(("PostCategoryID", 2), ("BlogID", Blog), ("PostID", published), ("CategoryID", mcp))],
            ["be_PostTag"] = [Row(("PostTagID", 1), ("BlogID", Blog), ("PostID", published), ("Tag", "Blog")), Row(("PostTagID", 2), ("BlogID", Blog), ("PostID", published), ("Tag", "blog"))],
            ["be_Pages"] =
            [
                Row(("PageRowID", 1), ("BlogID", Blog), ("PageID", disclaimer), ("Title", "Disclaimer"), ("Description", null), ("PageContent", "<p>d</p>"), ("Keywords", null), ("DateCreated", null), ("DateModified", null), ("IsPublished", true), ("IsFrontPage", false), ("Parent", Guid.Empty), ("ShowInList", true), ("Slug", "disclaimer"), ("IsDeleted", false), ("SortOrder", 0)),
                Row(("PageRowID", 2), ("BlogID", Blog), ("PageID", stub), ("Title", "Angular"), ("Description", null), ("PageContent", "ng new"), ("Keywords", null), ("DateCreated", null), ("DateModified", null), ("IsPublished", true), ("IsFrontPage", false), ("Parent", Guid.Empty), ("ShowInList", true), ("Slug", "angular"), ("IsDeleted", false), ("SortOrder", 0)),
            ],
        };

    [Fact]
    public async Task Projection_CreatesUnpublishedDraftsOnly_ForPublishedLivePosts_MergingCategoriesAndTags()
    {
        var store = await SeededStoreAsync();
        var (published, draft, deleted, skipped) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var tables = Tables(published, draft, deleted, skipped, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        var (_, result, posts, categories, tags, pages) = await ProjectAsync(store, tables, apply: true);

        Assert.Equal((2, 1, 1, 1), (result.Categories, result.Tags, result.Pages, result.Posts));
        var post = await posts.GetAsync(published.ToString());
        Assert.Equal("MD[published-post]:<p>x</p>", post!.GetValue("Content"));
        Assert.Equal(false, post.GetValue("IsPublished"));
        Assert.Equal(2, post.GetValues("Categories").Count);
        Assert.Single(post.GetValues("Tags"));
        Assert.Null(await posts.GetAsync(draft.ToString()));
        Assert.Null(await posts.GetAsync(deleted.ToString()));
        Assert.Null(await posts.GetAsync(skipped.ToString()));
        Assert.Equal(2, await categories.CountAsync());
        Assert.Equal(1, await tags.CountAsync());
        Assert.Equal(1, await pages.CountAsync());
        Assert.Contains(result.Skipped, s => s.Contains("skipped-post"));
        Assert.Contains(result.Skipped, s => s.Contains("angular"));
    }

    [Fact]
    public async Task Projection_ADryRunWritesNothing_AndAReRunLeavesExistingEntitiesUntouched()
    {
        var store = await SeededStoreAsync();
        var (published, draft, deleted, skipped, general, mcp, disclaimer) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var tables = Tables(published, draft, deleted, skipped, general, Guid.NewGuid(), mcp, disclaimer, Guid.NewGuid());

        var (_, dry, posts, _, _, _) = await ProjectAsync(store, tables, apply: false);
        Assert.Equal(1, dry.Posts);
        Assert.Null(await posts.GetAsync(published.ToString()));

        await ProjectAsync(store, tables, apply: true);
        var post = await posts.GetAsync(published.ToString());
        post!.Set("Title", post.GetFieldValue("Title")!.Id.Value, "Edited in the admin");
        await posts.UpdateAsync(post);

        var (_, again, _, _, _, _) = await ProjectAsync(store, tables, apply: true);

        Assert.Equal((0, 0, 0, 0), (again.Categories, again.Tags, again.Pages, again.Posts));
        Assert.True(again.AlreadyThere >= 5);
        Assert.Equal("Edited in the admin", (await posts.GetAsync(published.ToString()))!.GetValue("Title"));
    }
}
