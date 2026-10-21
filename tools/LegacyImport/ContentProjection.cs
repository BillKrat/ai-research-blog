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
/// The live layer, projected from the mirror rows: categories (merged by name), tags, pages and posts as Markdown drafts. Rules: only rows
/// that were published and not deleted are projected; posts and pages arrive unpublished (the human publishes after review); an entity
/// that already exists is never touched, so edits made in the admin survive a re-run; the live id of a post, page or category is its legacy GUID
/// (a name-derived id for tags and merged categories), so a later run finds the same entity.
/// </summary>
public static class ContentProjection
{
    public static readonly IReadOnlyList<string> DefaultSkippedPostSlugs = ["Welcome-to-BlogHelps-blog"];
    public static readonly IReadOnlyList<string> DefaultPageSlugs = ["disclaimer"];

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

        // categories merged by name (the legacy table has one row per blog: "General" appears twice)
        var categoryNameById = tables["be_Categories"].ToDictionary(r => (Guid)r["CategoryID"]!, r => ((string?)r["CategoryName"])?.Trim() ?? string.Empty);
        foreach (var name in categoryNameById.Values.Where(n => n.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var id = LegacyIds.ForCategoryName(name);
            if (await categories.GetAsync(id.ToString(), includeDeleted: true, cancellationToken) is not null)
            {
                existing++;
                continue;
            }

            categoryCount++;
            if (apply)
            {
                var entity = new Category(categorySchema);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                entity.Set("Name", Guid.NewGuid().ToString(), name);
                var description = tables["be_Categories"].FirstOrDefault(r => string.Equals(((string?)r["CategoryName"])?.Trim(), name, StringComparison.OrdinalIgnoreCase))?["Description"] as string;
                if (!string.IsNullOrWhiteSpace(description))
                {
                    entity.Set("Description", Guid.NewGuid().ToString(), description);
                }

                await categories.CreateAsync(entity, cancellationToken);
            }
        }

        var postCategories = tables["be_PostCategory"].GroupBy(r => (Guid)r["PostID"]!).ToDictionary(g => g.Key, g => g.Select(r => (Guid)r["CategoryID"]!).ToList());
        var postTags = tables["be_PostTag"].GroupBy(r => (Guid)r["PostID"]!).ToDictionary(g => g.Key, g => g.Select(r => ((string?)r["Tag"])?.Trim() ?? string.Empty).Where(t => t.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList());

        foreach (var tag in postTags.Values.SelectMany(t => t).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var id = LegacyIds.ForTagName(tag);
            if (await tags.GetAsync(id.ToString(), includeDeleted: true, cancellationToken) is not null)
            {
                existing++;
                continue;
            }

            tagCount++;
            if (apply)
            {
                var entity = new Tag(tagSchema);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                entity.Set("Name", Guid.NewGuid().ToString(), tag);
                await tags.CreateAsync(entity, cancellationToken);
            }
        }

        // pages: only the listed slugs (the rest of the legacy page tree is stubs or the human's design notes)
        var livePages = tables["be_Pages"].Where(r => IsLive(r)).ToList();
        foreach (var row in livePages)
        {
            var slug = (string?)row["Slug"] ?? string.Empty;
            if (!pageSlugs.Contains(slug, StringComparer.OrdinalIgnoreCase))
            {
                skipped.Add($"page '{slug}' (not in the migrate list)");
                continue;
            }

            var id = (Guid)row["PageID"]!;
            if (await pages.GetAsync(id.ToString(), includeDeleted: true, cancellationToken) is not null)
            {
                existing++;
                continue;
            }

            pageCount++;
            if (apply)
            {
                var entity = new Page(pageSchema);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                Put(entity, "Title", row["Title"]);
                Put(entity, "Slug", slug);
                Put(entity, "Description", row["Description"]);
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

        foreach (var row in tables["be_Posts"].Where(r => IsLive(r)))
        {
            var slug = (string?)row["Slug"] ?? string.Empty;
            if (skipPostSlugs.Contains(slug, StringComparer.OrdinalIgnoreCase))
            {
                skipped.Add($"post '{slug}' (skip list)");
                continue;
            }

            var id = (Guid)row["PostID"]!;
            if (await posts.GetAsync(id.ToString(), includeDeleted: true, cancellationToken) is not null)
            {
                existing++;
                continue;
            }

            postCount++;
            if (apply)
            {
                var entity = new Post(postSchema);
                entity.Set("Id", Guid.NewGuid().ToString(), id);
                Put(entity, "Title", row["Title"]);
                Put(entity, "Slug", slug);
                Put(entity, "Description", row["Description"]);
                Put(entity, "Content", converter.Convert((string?)row["PostContent"] ?? string.Empty, slug));
                Put(entity, "EnableComments", row["IsCommentEnabled"]);
                Put(entity, "IsPublished", false);
                foreach (var categoryId in (postCategories.GetValueOrDefault(id) ?? []).Select(c => categoryNameById.GetValueOrDefault(c)).Where(n => !string.IsNullOrEmpty(n)).Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    entity.Add("Categories", Guid.NewGuid().ToString(), LegacyIds.ForCategoryName(categoryId!).ToString());
                }

                foreach (var tag in postTags.GetValueOrDefault(id) ?? [])
                {
                    entity.Add("Tags", Guid.NewGuid().ToString(), LegacyIds.ForTagName(tag).ToString());
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
