// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Data.NQuad;
using Adventures.Entities;
using LegacyImport;
using McpServer.WebApi.BlogAi;
using Microsoft.Extensions.Configuration;
using Npgsql;

// Legacy BlogAI -> N-Quad import (stage B of the schema-faithful migration; docs/Claude-decision-2026-10-legacy-table-migration-plan.md).
//
//   LegacyImport [--apply] [--mirror-only | --content-only] [--tables be_Posts,be_Pages] [--skip-post <slug>] [--page <slug>]
//
// Dry run unless --apply: reads the legacy rows, compares them with the store and prints what would change. The target is the LOCAL
// Postgres by default (host must be localhost): the connection string is the WebApi's own ConnectionStrings:Postgres user-secret.
// --production --pg-host H --pg-port P --pg-database D --pg-user U (password in PG_PASSWORD) targets a hosted database instead.
// The legacy rows come from the MCP blogai_rows tool; run it through the vault so the research client secret exists only in this process:
//   .\docs\Claude-secret.ps1 run m2m/claude-research/claude-research -EnvVar CLAUDE_RESEARCH_SECRET -Exec dotnet -ExecArgs 'run','--project','ai-research-blog\tools\LegacyImport','--','--apply'

var arguments = args.ToList();
bool Flag(string name) => arguments.Contains(name);
string? Option(string name) => arguments.IndexOf(name) is var i and >= 0 && i + 1 < arguments.Count ? arguments[i + 1] : null;
IReadOnlyList<string> Options(string name) => arguments.Select((a, i) => (a, i)).Where(t => t.a == name && t.i + 1 < arguments.Count).Select(t => arguments[t.i + 1]).ToList();

var apply = Flag("--apply");
var configuration = new ConfigurationBuilder()
    .AddUserSecrets("aiblogresearch-webapi-c9b1f4b2-8f3a-4a3a-9d1e-6a6b4d0b3f21")
    .AddEnvironmentVariables()
    .Build();

// Target: the local development database by default (the WebApi user-secret, host must be localhost). With --production the target is the
// hosted database named on the command line (host, port, database, user are not secrets) and the password comes from PG_PASSWORD in the
// environment (the vault run); --apply is then still needed to write, and the banner says PRODUCTION.
var production = Flag("--production");
string? connection;
if (production)
{
    var password = Environment.GetEnvironmentVariable("PG_PASSWORD");
    if (Option("--pg-host") is not { } pgHost || Option("--pg-database") is not { } pgDatabase || Option("--pg-user") is not { } pgUser || string.IsNullOrEmpty(password))
    {
        Console.Error.WriteLine("--production needs --pg-host, --pg-database, --pg-user (and --pg-port, default 5432) on the command line and PG_PASSWORD in the environment.");
        return 2;
    }

    connection = new NpgsqlConnectionStringBuilder
    {
        Host = pgHost,
        Port = int.TryParse(Option("--pg-port"), out var pgPort) ? pgPort : 5432,
        Database = pgDatabase,
        Username = pgUser,
        Password = password,
        SslMode = SslMode.Require,
        TrustServerCertificate = true,
        Timeout = 30,
    }.ConnectionString;
}
else
{
    connection = configuration.GetConnectionString("Postgres");
    if (string.IsNullOrWhiteSpace(connection))
    {
        Console.Error.WriteLine("ConnectionStrings:Postgres is not set (the WebApi user-secret).");
        return 2;
    }

    var localHost = new NpgsqlConnectionStringBuilder(connection).Host ?? string.Empty;
    if (localHost is not ("localhost" or "127.0.0.1" or "::1"))
    {
        Console.Error.WriteLine($"Refusing: the target database host is not local ('{localHost}'). Use --production with explicit --pg-* options to write to a hosted database.");
        return 2;
    }
}

var host = new NpgsqlConnectionStringBuilder(connection).Host ?? string.Empty;
if (production)
{
    Console.WriteLine($"WARNING: the target is the hosted database {new NpgsqlConnectionStringBuilder(connection).Database} on {host}, the live site's data. {(apply ? "--apply is set: this run WRITES." : "No --apply: nothing is written.")}");
}

var secret = Environment.GetEnvironmentVariable("CLAUDE_RESEARCH_SECRET");
if (string.IsNullOrEmpty(secret))
{
    Console.Error.WriteLine("No CLAUDE_RESEARCH_SECRET in the environment: run this through Claude-secret.ps1 run (see the header).");
    return 2;
}

var wanted = (Option("--tables")?.Split(',', StringSplitOptions.RemoveEmptyEntries) ?? BlogAiTables.All.Select(t => t.Name).ToArray()).ToHashSet(StringComparer.Ordinal);
var tables = BlogAiTables.All.Where(t => wanted.Contains(t.Name)).ToList();
var cancellation = CancellationToken.None;

Console.WriteLine($"{(apply ? "APPLY" : "DRY RUN")} against {new NpgsqlConnectionStringBuilder(connection).Database} on {host}");

var store = new NpgsqlNQuadStore(connection, configuration["NQuadStore:Table"] ?? "app_n_quads");
var seedDirectory = FindSeedDirectory();
if (apply)
{
    // the mirror schemas (seeds 009, 010) and the content schemas must exist; each named seed applies once
    await store.SeedOnceAsync(Path.Combine(seedDirectory, "seed-009-legacy-schemas.nq"), EntityConstants.Legacy.SchemaSeedName, cancellation);
    await store.SeedOnceAsync(Path.Combine(seedDirectory, "seed-010-legacy-ids.nq"), EntityConstants.Legacy.IdFieldsSeedName, cancellation);
    await store.SeedOnceAsync(Path.Combine(seedDirectory, "seed-012-legacy-wave2.nq"), EntityConstants.Legacy.Wave2SeedName, cancellation);
}

var quads = await store.QueryAsync(cancellationToken: cancellation);
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
var source = new McpRowsSource(
    http,
    Environment.GetEnvironmentVariable("CLAUDE_RESEARCH_API") ?? "https://api.global-webnet.com",
    Environment.GetEnvironmentVariable("CLAUDE_RESEARCH_MCP") ?? "https://mcp.global-webnet.com/mcp",
    secret);

var data = new Dictionary<string, IReadOnlyList<LegacyRowData>>(StringComparer.Ordinal);
foreach (var table in BlogAiTables.All.Where(t => tables.Any(w => w.Name == t.Name) || t.Name is "be_Categories" or "be_PostCategory" or "be_PostTag" or "be_Posts" or "be_Pages"))
{
    data[table.Name] = await source.ReadAllAsync(table.Name, table.Columns.Select(c => (c.Name, c.Type)).ToList(), cancellation);
}

var failed = false;
if (!Flag("--content-only"))
{
    Console.WriteLine();
    Console.WriteLine("MIRROR (legacy schemas)");
    Console.WriteLine($"{"table",-16} {"read",5} {"new",5} {"changed",7} {"same",5} {"mismatch",8}");
    foreach (var table in tables)
    {
        var schemaIri = LegacySchemaSeed.SchemaBase + table.Name;
        if (!quads.Any(q => q.Subject == schemaIri))
        {
            Console.WriteLine($"{table.Name,-16} schema not in the store yet; run with --apply once to seed it");
            continue;
        }

        var schema = SchemaDal.Load(quads, schemaIri);
        var result = await MirrorImporter.ImportAsync(table, data[table.Name], schema, MirrorImporter.Repository(store, schema, table.Name), apply, cancellation);
        Console.WriteLine($"{result.Table,-16} {result.Read,5} {result.Created,5} {result.Updated,7} {result.Unchanged,5} {result.Mismatches,8}");
        foreach (var note in result.Notes.Take(10))
        {
            Console.WriteLine($"    {note}");
        }

        failed |= result.Mismatches > 0;
    }
}

if (!Flag("--mirror-only"))
{
    Console.WriteLine();
    Console.WriteLine("LIVE PROJECTION (content, as unpublished drafts)");
    EntitySchema Live(string iri) => SchemaDal.Load(quads, iri);
    NQuadEntityRepository<T> Repo<T>(string schemaIri, string baseIri, string typeIri, Func<EntitySchema, T> factory) where T : DynamicEntity =>
        new(store, Live(schemaIri), baseIri, typeIri, EntityConstants.Content.DefaultGraph, factory, changedBy: "legacy-import");

    var categorySchema = Live(EntityConstants.Content.CategorySchemaIri);
    var tagSchema = Live(EntityConstants.Content.TagSchemaIri);
    var pageSchema = Live(EntityConstants.Content.PageSchemaIri);
    var postSchema = Live(EntityConstants.Content.PostSchemaIri);
    var projection = await ContentProjection.ProjectAsync(
        data,
        Repo(EntityConstants.Content.CategorySchemaIri, EntityConstants.Content.CategoryBaseIri, EntityConstants.Content.CategoryTypeIri, s => new Category(s)),
        Repo(EntityConstants.Content.TagSchemaIri, EntityConstants.Content.TagBaseIri, EntityConstants.Content.TagTypeIri, s => new Tag(s)),
        Repo(EntityConstants.Content.PageSchemaIri, EntityConstants.Content.PageBaseIri, EntityConstants.Content.PageTypeIri, s => new Page(s)),
        Repo(EntityConstants.Content.PostSchemaIri, EntityConstants.Content.PostBaseIri, EntityConstants.Content.PostTypeIri, s => new Post(s)),
        categorySchema,
        tagSchema,
        pageSchema,
        postSchema,
        new NodeMarkdownConverter(FindConverter()),
        Options("--skip-post").Count > 0 ? Options("--skip-post") : ContentProjection.DefaultSkippedPostSlugs,
        Options("--page").Count > 0 ? Options("--page") : ContentProjection.DefaultPageSlugs,
        apply,
        cancellation);
    Console.WriteLine($"{(apply ? "created" : "would create")}: {projection.Categories} categories, {projection.Tags} tags, {projection.Pages} pages, {projection.Posts} posts; already there (left untouched): {projection.AlreadyThere}");
    foreach (var skipped in projection.Skipped)
    {
        Console.WriteLine($"    skipped: {skipped}");
    }
}

Console.WriteLine();
Console.WriteLine(failed ? "RESULT: mismatches found (see above)" : "RESULT: ok");
return failed ? 1 : 0;

static string FindSeedDirectory() => FindUp(Path.Combine("Adventures.Foundation", "src", "Adventures.Data.NQuad", "Sql", "seed"));

static string FindConverter() => FindUp(Path.Combine("ai-research-blog", "tools", "legacy-migrate", "convert.mjs"));

static string FindUp(string relative)
{
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
    {
        var candidate = Path.Combine(directory.FullName, relative);
        if (File.Exists(candidate) || Directory.Exists(candidate))
        {
            return candidate;
        }
    }

    throw new FileNotFoundException($"Could not find '{relative}' above {AppContext.BaseDirectory}.");
}
