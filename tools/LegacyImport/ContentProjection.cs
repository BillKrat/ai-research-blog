// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Diagnostics;
using System.Text.Json;
using Adventures.Data.NQuad;
using Adventures.Entities;

namespace LegacyImport;

/// <summary>Turns legacy HTML into Markdown (the reviewed converter in tools/legacy-migrate, so the output equals what the drafts already carry).</summary>
public interface IMarkdownConverter
{
    string Convert(string html, string slug);
}

public sealed class NodeMarkdownConverter(string converterPath) : IMarkdownConverter
{
    public string Convert(string html, string slug)
    {
        var temp = Path.Combine(Path.GetTempPath(), $"legacy-{Guid.NewGuid():N}.html");
        File.WriteAllText(temp, html, new System.Text.UTF8Encoding(false));
        try
        {
            var start = new ProcessStartInfo("node") { RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = System.Text.Encoding.UTF8 };
            foreach (var argument in new[] { converterPath, "--slug", slug, "--in", temp })
            {
                start.ArgumentList.Add(argument);
            }

            using var process = Process.Start(start) ?? throw new InvalidOperationException("node could not be started.");
            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            return process.ExitCode == 0
                ? JsonDocument.Parse(output).RootElement.GetProperty("markdown").GetString() ?? string.Empty
                : throw new InvalidOperationException($"The converter failed for '{slug}': {process.StandardError.ReadToEnd()}");
        }
        finally
        {
            File.Delete(temp);
        }
    }
}

/// <summary>What the live projection did.</summary>
public sealed record ProjectionResult(int Categories, int Tags, int Pages, int Posts, int AlreadyThere, IReadOnlyList<string> Skipped);

/// <summary>
/// The live layer, projected from the mirror rows: categories, tags, pages and posts as Markdown drafts. Rules:
/// only rows that were published and not deleted are projected; posts and pages arrive unpublished (the human publishes after review);
/// nothing that already exists is touched, so edits made in the admin survive a re-run. "Already exists" means the same id, or, for
/// posts and pages, the same slug (a draft made earlier through the authoring surface has a random id), and for categories and tags the
/// same name. The live id of a post, page or category is its legacy GUID (a name-derived id for categories and tags), so a later run finds the same entity.
/// Categories follow the rules used for the first drafts: the legacy "General" and "AI Systems Author" are dropped, "MCP Bridge" becomes "MCP",
/// a post of the BlogAI design blog gets "BlogAI design", and a post left with no category gets "AI".
/// </summary>
public static class ContentProjection
{
    public static readonly IReadOnlyList<string> DefaultSkippedPostSlugs = ["Welcome-to-BlogHelps-blog"];
    public static readonly IReadOnlyList<string> DefaultPageSlugs = ["disclaimer"];

    private static readonly Dictionary<string, string?> CategoryMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["General"] = null,
        ["AI Systems Author"] = null,
        ["MCP Bridge"] = "MCP",
    };

    /// <summary>The live category names of one legacy post (see the class remarks).</summary>
    public static IReadOnlyList<string> MapCategories(string blogName, IEnumerable<string> legacyNames)
    {
        var names = legacyNames.Select(n => n.Trim()).Where(n => n.Length > 0)
            .Select(n => CategoryMap.TryGetValue(n, out var mapped) ? mapped : n)
            .Where(n => !string.IsNullOrEmpty(n))
            .Select(n => n!)
            .ToList();
        if (string.Equals(blogName, "BlogAI", StringComparison.OrdinalIgnoreCase))
        {
            names.Add("BlogAI design");
        }

        if (names.Count == 0)
        {
            names.Add("AI");
        }

        return names.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    public static async Task<ProjectionResult> ProjectAsync(
        IReadOnlyDictionary<string, IReadOnlyList<LegacyRowData>> tables,
        IEntityRepository<Category> categories,
        IEntityRepository<Tag> tags,
        IEntityRepository<Page> pages,
        IEntityRepository<Post> posts,
        EntitySchema categorySchema,
        EntitySchema tagSchema,
        EntitySchema pageSchema,
        EntitySchema postSchema,
        IMarkdownConverter converter,
        IReadOnlyList<string> skipPostSlugs,
        IReadOnlyList<string> pageSlugs,
        bool apply,
        CancellationToken cancellationToken)
    {
        int categoryCount = 0, tagCount = 0, pageCount = 0, postCount = 0, existing = 0;
        var skipped = new List<string>();

        var blogNames = tables["be_Blogs"].ToDictionary(r => (Guid)r["BlogId"]!, r => (string?)r["BlogName"] ?? string.Empty);
        var legacyCategoryNames = tables["be_Categories"].ToDictionary(r => (Guid)r["CategoryID"]!, r => ((string?)r["CategoryName"])?.Trim() ?? string.Empty);
        var categoryDescriptions = tables["be_Categories"].Where(r => !string.IsNullOrWhiteSpace((string?)r["Description"]))
            .GroupBy(r => ((string?)r["CategoryName"])!.Trim(), StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => (string)g.First()["Description"]!, StringComparer.OrdinalIgnoreCase);
        var postCategories = tables["be_PostCategory"].GroupBy(r => (Guid)r["PostID"]!).ToDictionary(g => g.Key, g => g.Select(r => legacyCategoryNames.GetValueOrDefault((Guid)r["CategoryID"]!) ?? string.Empty).ToList());
        var postTags = tables["be_PostTag"].GroupBy(r => (Guid)r["PostID"]!).ToDictionary(g => g.Key, g => g.Select(r => ((string?)r["Tag"])?.Trim() ?? string.Empty).Where(t => t.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList());

        // what the target already holds, by name and by slug
        var existingCategoryIds = (await categories.ListAsync(includeDeleted: true, cancellationToken)).ToDictionary(c => ((string?)c.GetValue("Name") ?? string.Empty).Trim(), c => c.EntityId!.Value, StringComparer.OrdinalIgnoreCase);
        var existingTagIds = (await tags.ListAsync(includeDeleted: true, cancellationToken)).ToDictionary(t => ((string?)t.GetValue("Name") ?? string.Empty).Trim(), t => t.EntityId!.Value, StringComparer.OrdinalIgnoreCase);
        var existingPostSlugs = (await posts.ListAsync(includeDeleted: true, cancellationToken)).Select(p => ((string?)p.GetValue("Slug") ?? string.Empty).ToLowerInvariant()).ToHashSet();
        var existingPageSlugs = (await pages.ListAsync(includeDeleted: true, cancellationToken)).Select(p => ((string?)p.GetValue("Slug") ?? string.Empty).ToLowerInvariant()).ToHashSet();

        var projectedPosts = tables["be_Posts"].Where(IsLive).Where(r => !skipPostSlugs.Contains((string?)r["Slug"] ?? string.Empty, StringComparer.OrdinalIgnoreCase)).ToList();
        var categoryNamesByPost = projectedPosts.ToDictionary(r => (Guid)r["PostID"]!, r => MapCategories(blogNames.GetValueOrDefault((Guid)r["BlogID"]!) ?? string.Empty, postCategories.GetValueOrDefault((Guid)r["PostID"]!) ?? []));

        string CategoryId(string name) => existingCategoryIds.TryGetValue(name, out var id) ? id : LegacyIds.ForCategoryName(name).ToString();
        string TagId(string name) => existingTagIds.TryGetValue(name, out var id) ? id : LegacyIds.ForTagName(name).ToString();

        foreach (var name in categoryNamesByPost.Values.SelectMany(n => n).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (existingCategoryIds.ContainsKey(name))
            {
                existing++;
                continue;
            }

            categoryCount++;
            if (apply)
            {
                var entity = new Category(categorySchema);
                var id = LegacyIds.ForCategoryName(name);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                entity.Set("Name", Guid.NewGuid().ToString(), name);
                if (categoryDescriptions.TryGetValue(name, out var description))
                {
                    entity.Set("Description", Guid.NewGuid().ToString(), description);
                }

                await categories.CreateAsync(entity, cancellationToken);
                existingCategoryIds[name] = id.ToString();
            }
        }

        foreach (var tag in projectedPosts.SelectMany(r => postTags.GetValueOrDefault((Guid)r["PostID"]!) ?? []).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (existingTagIds.ContainsKey(tag))
            {
                existing++;
                continue;
            }

            tagCount++;
            if (apply)
            {
                var entity = new Tag(tagSchema);
                var id = LegacyIds.ForTagName(tag);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                entity.Set("Name", Guid.NewGuid().ToString(), tag);
                await tags.CreateAsync(entity, cancellationToken);
                existingTagIds[tag] = id.ToString();
            }
        }

        // pages: only the listed slugs (the rest of the legacy page tree is stubs or the human's design notes)
        var livePages = tables["be_Pages"].Where(IsLive).ToList();
        foreach (var row in livePages)
        {
            var slug = (string?)row["Slug"] ?? string.Empty;
            if (!pageSlugs.Contains(slug, StringComparer.OrdinalIgnoreCase))
            {
                skipped.Add($"page '{slug}' (not in the migrate list)");
                continue;
            }

            var id = (Guid)row["PageID"]!;
            if (existingPageSlugs.Contains(slug.ToLowerInvariant()) || await pages.GetAsync(id.ToString(), includeDeleted: true, cancellationToken) is not null)
            {
                existing++;
                skipped.Add($"page '{slug}' already exists (same slug or id); left untouched");
                continue;
            }

            pageCount++;
            if (apply)
            {
                var entity = new Page(pageSchema);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                Put(entity, "Title", row["Title"]);
                Put(entity, "Slug", slug);
                Put(entity, "Description", DescriptionText.Clean(row["Description"] as string));
                Put(entity, "Keywords", row["Keywords"]);
                Put(entity, "Content", converter.Convert((string?)row["PageContent"] ?? string.Empty, slug));
                Put(entity, "SortOrder", row["SortOrder"]);
                Put(entity, "ShowInList", row["ShowInList"]);
                Put(entity, "IsFrontPage", row["IsFrontPage"]);
                Put(entity, "IsPublished", false);
                if (row["Parent"] is Guid parent && parent != Guid.Empty && livePages.Any(p => (Guid)p["PageID"]! == parent))
                {
                    entity.Set("Parent", Guid.NewGuid().ToString(), parent.ToString());
                }

                await pages.CreateAsync(entity, cancellationToken);
            }
        }

        foreach (var row in tables["be_Posts"].Where(IsLive))
        {
            var slug = (string?)row["Slug"] ?? string.Empty;
            if (skipPostSlugs.Contains(slug, StringComparer.OrdinalIgnoreCase))
            {
                skipped.Add($"post '{slug}' (skip list)");
                continue;
            }

            var id = (Guid)row["PostID"]!;
            if (existingPostSlugs.Contains(slug.ToLowerInvariant()) || await posts.GetAsync(id.ToString(), includeDeleted: true, cancellationToken) is not null)
            {
                existing++;
                skipped.Add($"post '{slug}' already exists (same slug or id); left untouched");
                continue;
            }

            postCount++;
            if (apply)
            {
                var entity = new Post(postSchema);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                Put(entity, "Title", row["Title"]);
                Put(entity, "Slug", slug);
                Put(entity, "Description", DescriptionText.Clean(row["Description"] as string));
                Put(entity, "Content", converter.Convert((string?)row["PostContent"] ?? string.Empty, slug));
                Put(entity, "EnableComments", row["IsCommentEnabled"]);
                Put(entity, "IsPublished", false);
                foreach (var name in categoryNamesByPost[id])
                {
                    entity.Add("Categories", Guid.NewGuid().ToString(), CategoryId(name));
                }

                foreach (var tag in postTags.GetValueOrDefault(id) ?? [])
                {
                    entity.Add("Tags", Guid.NewGuid().ToString(), TagId(tag));
                }

                await posts.CreateAsync(entity, cancellationToken);
            }
        }

        return new ProjectionResult(categoryCount, tagCount, pageCount, postCount, existing, skipped);
    }

    private static bool IsLive(LegacyRowData row) => row["IsPublished"] is true && row["IsDeleted"] is not true;

    private static void Put(DynamicEntity entity, string field, object? value)
    {
        if (value is null || value is string { Length: 0 })
        {
            return;
        }

        entity.Set(field, Guid.NewGuid().ToString(), value);
    }
}
