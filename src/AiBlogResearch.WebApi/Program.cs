// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - security findings F-1 to F-3 fixed in this file or in code it uses, covered by tests. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
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
using Adventures.MEF.WebApi;

// Bootstrap logger: catches and logs anything that goes wrong before the real Serilog pipeline
// (which needs configuration/DI to be built) is up - including a crash inside WebApplication.CreateBuilder
// itself. Without this, a startup-time exception (e.g. missing required config) produces nothing but
// IIS's own bare 500 page in production, with zero trace of what actually failed - which is exactly
// what happened here: the app works locally (config comes from user-secrets) but 500s in production
// with no diagnostic anywhere, because nothing was ever logged.
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File(Path.Combine(AppContext.BaseDirectory, "logs", "startup-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Missing configuration is reported, not fatal: a small app answers 503 with what is missing and how to fix it (see StartupChecks),
    // so the page in the browser says so instead of waiting on an API that never started.
    var startupProblems = StartupChecks.Find(builder.Configuration, builder.Environment.IsDevelopment());
    if (startupProblems.Count > 0)
    {
        await StartupChecks.RunReportingAppAsync(args, startupProblems, builder.Environment.IsDevelopment(),
            string.Equals(builder.Configuration[LiveDataMode.EnabledKey], "true", StringComparison.OrdinalIgnoreCase));
        return;
    }

    // Local development against the live store (opt-in, Development only; see LiveDataMode): the connection is switched here,
    // before anything reads ConnectionStrings:Postgres, and the startup seeding below is skipped.
    var liveData = LiveDataMode.Apply(builder.Configuration, builder.Environment.IsDevelopment());
    if (liveData)
    {
        builder.Configuration["LiveData:Active"] = "true";
    }

    // Which data layer this host runs on (Data:Mode = New | Legacy). Only registrations differ between the two; no Bll, presenter or controller knows the mode.
    // Legacy serves posts, pages, categories and tags from a BlogEngine.NET SQL Server database (ConnectionStrings:LegacySql) and everything else
    // from the in-memory store seeded at start; collaboration is switched off; sign-in is the developer-testing account (see DevLoginOptions).
    var dataMode = DataModes.Parse(builder.Configuration[DataModes.SettingName]);
    var legacy = dataMode == DataMode.Legacy;
    var legacySql = builder.Configuration.GetConnectionString("LegacySql");
    if (legacy && (liveData || string.IsNullOrWhiteSpace(legacySql)))
    {
        throw new InvalidOperationException("Data:Mode=Legacy needs ConnectionStrings:LegacySql and cannot be combined with live data mode.");
    }

    // Every line carries the request's CorrelationId (pushed by the middleware below into the LogContext). The text log is
    // for people; the compact JSON sibling (one JSON object per line, "CorrelationId" a top-level field) is for tools - an
    // MCP diagnostics tool filters it by id without parsing text.
    builder.Host.UseAppSerilog();

    builder.AddServiceDefaults();

    // Add services to the container.

    builder.Services.AddAppPlatform(builder.Configuration, builder.Environment.IsDevelopment());

    // Adventures.Data/Adventures.Identity: registered so IUserAccountService is available to
    // AuthController, which uses it for the real login (see
    // docs/artifacts/Claude-2026-09-21-real-login-wired.md). Lazy:
    // NpgsqlSqlExecutor doesn't open a connection until something actually queries through it, so
    // this registration alone can't reproduce today's Jwt:SigningKey-shaped startup crash even if
    // ConnectionStrings:Postgres is ever missing in an environment.
    builder.Services.AddAppIdentity(legacy, builder.Configuration, builder.Environment.IsDevelopment());

    // Adventures.Ioc's reflection-based auto-registration for the Bll/Dal/Presenter MvpVm pattern
    // (see Adventures.Common.Tests/MvpVmTests.cs) - picks up UserBll and UserPresenter below.
    // The scan only sees loaded assemblies, so load every referenced library first (see AppAssemblies).
    AppAssemblies.EnsureReferencedLoaded();
    // Plug-ins: exported IPluginModule from the host libraries and, when Plugins:Directory is set, from a folder of approved DLLs (see Adventures.MEF).
    builder.Services.AddPluginDiscovery(builder.Configuration, AppAssemblies.HostAssemblies(), [Adventures.MEF.WebApi.PluginWebRules.Validator]);
    // A plug-in may bring API controllers: only under api/plugins/{key}/, never anonymous, switched off with the plug-in (the rules above refuse a plug-in that breaks them).
    builder.Services.AddControllers().AddPluginControllers();
    // The in-process event bus for plug-ins: notifications run off the request for the plug-ins that are on for the tenant; interceptors may refuse (see Adventures.MEF).
    builder.Services.AddPluginEvents();
    // Encrypted secrets (plug-in settings of kind Secret): keys come from Encryption:CurrentKeyId and Encryption:Keys:<id> (host secrets, never the store). With none set the app
    // starts and a secret is refused, never stored as plain text; a bad key fails here, at start-up.
    builder.Services.AddFieldEncryption(builder.Configuration);
    builder.Services.AddSingleton<Adventures.MEF.IPluginEventContext, Adventures.WebApi.RequestTenantEventContext>();
    builder.Services.AddLifetimeServices();

    // User CRUDL runs on the newer, schema-driven Adventures.Entities/NQuadEntityRepository stack -
    // separate from the entities/standard_fields JSONB store IUserAccountService/login use above.
    // The N-Quad store is PostgreSQL-backed whenever ConnectionStrings:Postgres is configured (edits survive restarts
    // and app-pool recycles), in a table of its own - never "n_quads", which the Foundation test suite purges and
    // reseeds. NQuadStore:Provider = "Memory" opts out (offline development); NQuadStore:Table renames the table.
    // seed.nq is applied once (a marker quad records it) and never merged again: re-inserting it on a later start would
    // resurrect values the users have since edited. A seed change ships as a new, separately named seed file.
    var postgresConnection = builder.Configuration.GetConnectionString("Postgres");
    var useMemoryStore = string.Equals(builder.Configuration["NQuadStore:Provider"], "Memory", StringComparison.OrdinalIgnoreCase)
        || legacy
        || string.IsNullOrWhiteSpace(postgresConnection);
    INQuadStore nquadStore = useMemoryStore
        ? new InMemoryNQuadStore()
        : NQuadStoreFactory.CreatePostgres(postgresConnection!, builder.Configuration["NQuadStore:Layout"], builder.Configuration["NQuadStore:Table"], builder.Configuration["NQuadStore:Prefix"]);
    var seeded = false;
    // Live data mode runs on the shared development store, so it applies pending seeds like any start (named seeds apply once and only add
    // schema and defaults). Set LiveData:SkipSeeding=true to leave the store untouched instead.
    var skipSeeding = liveData && LiveDataMode.SkipSeeding(builder.Configuration);
    if (liveData)
    {
        Log.Warning(skipSeeding
            ? "LIVE DATA mode: this local run uses the shared store; startup seeding is skipped (LiveData:SkipSeeding)"
            : "LIVE DATA mode: this local run uses the shared store and applies pending seeds to it");
    }
    if (!skipSeeding)
    {
        seeded = await StartupSeeds.ApplyAsync(nquadStore, SeedProfile.BaselineFile(builder.Configuration, builder.Environment.IsDevelopment()));
    }
    Log.Information("N-Quad store: {Provider} at {Store}{Live}; baseline seed {SeedState}", useMemoryStore ? "memory" : "postgres", LiveDataMode.Describe(postgresConnection), liveData ? " (LIVE DATA)" : "", seeded ? "applied" : "already applied");
    var userQuads = await nquadStore.QueryAsync();
    if (skipSeeding && StartupChecks.FindMissingSchemas(userQuads, [CollaborationConstants.SchemaIri, PluginConstants.SchemaIri, PluginConstants.SettingSchemaIri, WidgetConstants.SchemaIri, BlogConstants.Content.VisitorCommentSchemaIri]) is { Count: > 0 } missingSchemas)
    {
        await StartupChecks.RunReportingAppAsync(args, missingSchemas, builder.Environment.IsDevelopment(), liveData);
        return;
    }

    builder.Services.AddSingleton<INQuadStore>(nquadStore);
    if (legacy)
    {
        // The whole Legacy switch: the SQL Dals are registered first, so the repository registrations below add no Dal for these types.
        builder.Services.AddBlogLegacy(legacySql!, Guid.TryParse(builder.Configuration["Legacy:BlogId"], out var legacyBlogId) ? legacyBlogId : null);
        // No stored plug-in state in this mode: the collaboration plug-ins are fixed off (see LegacyModePlugins), replacing what used to be written at start-up.
        builder.Services.AddScoped<Adventures.MEF.IPlugins, LegacyModePlugins>();
        Log.Information("Data mode: Legacy (BlogEngine SQL Server for posts, pages, categories and tags; collaboration off)");
    }
    // Uploaded images: in the same PostgreSQL database as the content (survives a redeploy, travels with the backup); memory for the in-memory development store.
    builder.Services.AddSingleton<IMediaStore>(useMemoryStore ? new InMemoryMediaStore() : new NpgsqlMediaStore(postgresConnection!, builder.Configuration["Media:Table"] ?? "app_media"));
    builder.Services.AddHttpContextAccessor();

    builder.Services.AddAppEntities(userQuads, builder.Configuration, builder.Environment.IsDevelopment());

    var app = builder.Build();

    // A plug-in or DLL that did not load is never silent: one warning per refusal here, and the whole report on the Plugins page.
    foreach (var refused in app.Services.GetRequiredService<PluginLoadReport>().Failures)
    {
        app.Logger.LogWarning("Plug-in not loaded ({Source}): {Reason}", refused.Source, refused.Reason);
    }

    await app.ApplyAsync(legacy, skipSeeding);

    app.UseAppPipeline();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "AiBlogResearch.WebApi terminated unexpectedly during startup");
    FailureJournal.Write(FailureJournal.DefaultDirectory, "startup", ex);
    throw;
}
finally
{
    Log.CloseAndFlush();
}

// Lets the test host (WebApplicationFactory) boot the real startup.
public partial class Program;
