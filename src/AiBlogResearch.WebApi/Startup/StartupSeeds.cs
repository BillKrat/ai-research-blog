// Startup composition: the once-only seeds (moved out of Program.cs, no behaviour change).
using Adventures.Common.Diagnostics;
using Adventures.Data;
using Adventures.Data.Postgres;
using Adventures.Identity.Postgres;
using Adventures.Data.NQuad;
using Adventures.Entities;
using Adventures.Identity;
using Adventures.Ioc.Extensions;
using Adventures.Security;
using Adventures.WebApi;
using AiBlogResearch.WebApi;
using Microsoft.AspNetCore.Diagnostics;
using Serilog;
using Adventures.Blog;
using Adventures.Blog.Legacy;
using Adventures.Blog.WebApi;
using Adventures.Collaboration.WebApi;
using Adventures.Diagnostics.WebApi;
using Adventures.Identity.WebApi;
using Adventures.Blog.Postgres;
using Adventures.Collaboration;
using Adventures.MEF;

namespace AiBlogResearch.WebApi;

internal static class StartupSeeds
{
    /// <summary>Initializes the store and applies the baseline and every named seed once; returns whether the baseline was applied just now.</summary>
    public static async Task<bool> ApplyAsync(INQuadStore store)
    {
        var seeded = false;
        if (store is INQuadStoreInitializer initializer)
        {
            await initializer.InitializeAsync();
        }

        var nquadSeedPath = Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed.nq");
        seeded = await store.SeedOnceAsync(nquadSeedPath, "baseline");
        // Named, once-only seeds added after the baseline (each ships as its own file, never merged into seed.nq).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-002-exception-log.nq"), ExceptionLogConstants.SeedName);
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-003-exception-signature.nq"), ExceptionLogConstants.SignatureSeedName);
        // The tenant and role model already in the baseline: seed 004 only describes it (schemas, and the User role-assignment relations).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-004-identity.nq"), IdentityConstants.SeedName);
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-005-identity-required.nq"), IdentityConstants.RequiredSeedName);
        // About me, Website and Picture address on the User schema (the profile page is built from the schema, so it shows them).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-027-profile-fields.nq"), IdentityConstants.ProfileSeedName);
        // The content model (pages, posts, categories, tags): new schemas under the schema host, modelled on the BlogEngine admin.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-006-content.nq"), BlogConstants.Content.SeedName);
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-007-post-taxonomy.nq"), BlogConstants.Content.TaxonomySeedName);
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-008-post-revision.nq"), BlogConstants.Content.RevisionSeedName);
        // The legacy mirror layer: one schema per ported BlogEngine.NET table (generated; see the legacy table migration plan). Schemas only, no data.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-009-legacy-schemas.nq"), EntityConstants.Legacy.SchemaSeedName);
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-010-legacy-ids.nq"), EntityConstants.Legacy.IdFieldsSeedName);
        // The review state of a collaboration post (Approval, ApprovedBy, ApprovedAt): changed only by the approve actions.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-013-post-approval.nq"), BlogConstants.Content.ApprovalSeedName);
        // How the Content of a post or page is written (Markdown or Html): a person in the admin writes Html, an AI and older posts are Markdown.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-022-content-format.nq"), BlogConstants.Content.ContentFormatSeedName);
        // What readers write under a post (pending until a person approves it).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-021-visitor-comments.nq"), BlogConstants.Content.VisitorCommentSeedName);
        // The conversation under a post (comments and decisions).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-014-comments.nq"), CollaborationConstants.CommentsSeedName);
        // Collaboration items (review requests and research questions): their own type, never public (not a post).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-015-collaboration.nq"), CollaborationConstants.SeedName);
        // The Research kind of collaboration item: Status, Sources and Findings.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-017-research.nq"), CollaborationConstants.ResearchSeedName);
        // The rights of the Admin, Editor, Reviewer and Developer roles (a Rights field on Role and its default values).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-018-role-rights.nq"), "018-role-rights");
        // Host aliases: the Aliases field on the tenant (which host names reach which tenant; changed only by a platform administrator).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-020-tenant-aliases.nq"), "020-tenant-aliases");
        // The on/off state of the built-in plug-ins (a plug-in with no stored state is on).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-016-plugins.nq"), PluginConstants.SeedName);
        // The settings an administrator customizes for a plug-in (the HTML sanitiser allow-list is the first); one row per plug-in and setting, per tenant.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-024-plugin-settings.nq"), PluginConstants.SettingSeedName);
        // Where each widget sits in the four zones (per tenant); the owner arranges them on the Widgets screen.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-025-widget-placements.nq"), WidgetConstants.SeedName);
        // The language files an administrator keeps for the site language (per tenant).
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-026-language-files.nq"), LanguageConstants.SeedName);
        // The site settings (title, tagline, posts per page, legacy time zone) with their four defaults; an administrator edits them afterwards.
        await store.SeedOnceAsync(
            Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-011-site-settings.nq"), BlogConstants.Site.SeedName);
        return seeded;
    }
}
