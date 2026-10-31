// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - security findings F-1 to F-3 fixed in this file or in code it uses, covered by tests. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Common.Diagnostics;
using Adventures.Data;
using Adventures.Data.NQuad;
using Adventures.Entities;
using Adventures.Identity;
using Adventures.Ioc.Extensions;
using Adventures.Security;
using Adventures.WebApi;
using AiBlogResearch.WebApi;
using Microsoft.AspNetCore.Diagnostics;
using Serilog;

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

    // Every line carries the request's CorrelationId (pushed by the middleware below into the LogContext). The text log is
    // for people; the compact JSON sibling (one JSON object per line, "CorrelationId" a top-level field) is for tools - an
    // MCP diagnostics tool filters it by id without parsing text.
    const string LogTemplate = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}";
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console(outputTemplate: LogTemplate)
        .WriteTo.File(
            Path.Combine(AppContext.BaseDirectory, "logs", "webapi-.log"),
            outputTemplate: LogTemplate,
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 14)
        .WriteTo.File(
            new Serilog.Formatting.Compact.RenderedCompactJsonFormatter(),
            Path.Combine(AppContext.BaseDirectory, "logs", "webapi-json-.log"),
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 14));

    builder.AddServiceDefaults();

    // Add services to the container.

    const string AngularCorsPolicy = "Angular";

    var allowedOrigins = Adventures.WebApi.SiteDomain.AllowedOrigins(builder.Configuration, builder.Environment.IsDevelopment()).ToArray();
    builder.Services.AddCors(options =>
    {
        options.AddPolicy(AngularCorsPolicy, policy =>
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .WithExposedHeaders(CorrelationIdMiddleware.HeaderName)
                .AllowAnyMethod();
        });
    });

    builder.Services.AddControllers();
    // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
    builder.Services.AddOpenApi();

    builder.Services.AddSharedJwtAuthentication(builder.Configuration);
    builder.Services.AddRequestHardening(builder.Configuration);
    builder.Services.AddSingleton(_ => new AiBlogResearch.WebApi.Controllers.HealthSnapshotCache(AiBlogResearch.WebApi.Controllers.HealthSnapshotCache.WindowFrom(builder.Configuration), TimeProvider.System));

    builder.Services.AddOptions<M2MClientsOptions>()
        .Bind(builder.Configuration.GetSection(M2MClientsOptions.SectionName));
    builder.Services.AddSingleton<IClientSecretHasher, ClientSecretHasher>();
    builder.Services.AddSingleton<IClientCredentialStore, InMemoryClientCredentialStore>();
    builder.Services.AddScopeAuthorization("mcp.postgres.query", "mcp.filesearch.search", AiBlogResearch.WebApi.Controllers.McpDiagnosticsController.RequiredScope, AiBlogResearch.WebApi.Controllers.AuthoringController.RequiredScope);
    builder.Services.AddRoleAuthorization(WellKnownClaims.TenantAdminRole);

    // McpServer:BaseUrl -> mcp.global-webnet.com. HealthController calls this over M2M auth (minting
    // its own "mcp-host" token in-process via IJwtTokenService, since this app IS the token issuer -
    // see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md) to prove the cross-site M2M pipeline end
    // to end. A short timeout keeps a slow/unreachable mcp site from hanging /api/health itself.
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers is marked experimental; it is the supported way to opt one client out.
    builder.Services.AddHttpClient("McpServer", (services, client) =>
    {
        var baseUrl = Adventures.WebApi.SiteDomain.McpBaseUrl(services.GetRequiredService<IConfiguration>())
            ?? throw new InvalidOperationException("McpServer:BaseUrl is not configured.");
        client.BaseAddress = new Uri(baseUrl);
        client.Timeout = TimeSpan.FromSeconds(10);
    })
    // This client only serves the health probe: no retries (the default resilience handler would turn one failure into
    // eight seconds of waiting), so /api/health answers promptly and says what failed.
    .RemoveAllResilienceHandlers()
    .AddCorrelationIdHandler();
#pragma warning restore EXTEXP0001
    builder.Services.AddCorrelationId();
    builder.Services.AddFailureReporting();
    builder.Services.AddScoped<IDependencyProbes>(sp => new DependencyProbes(
        sp.GetRequiredService<IJwtTokenService>(),
        sp.GetRequiredService<IHttpClientFactory>(),
        sp.GetService<INQuadStore>(),
        sp.GetRequiredService<ILoggerFactory>().CreateLogger<DependencyProbes>()));

    // The AI triage (an administrator's button): Anthropic:ApiKey is a secret (user-secrets locally, the host's environment
    // secret Anthropic__ApiKey in production); without it the button answers "not set up". One call can take many seconds
    // and is never retried automatically (a retry would double the cost), so this client opts out of the default resilience.
    builder.Services.Configure<AnthropicOptions>(builder.Configuration.GetSection(AnthropicOptions.SectionName));
#pragma warning disable EXTEXP0001
    builder.Services.AddHttpClient(AiTriage.ClientName, client =>
    {
        client.BaseAddress = new Uri("https://api.anthropic.com/");
        client.Timeout = TimeSpan.FromSeconds(90);
    }).RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
    builder.Services.AddSingleton<IAiTriage, AiTriage>();

    // Adventures.Data/Adventures.Identity: registered so IUserAccountService is available to
    // AuthController, which uses it for the real login (see
    // docs/artifacts/Claude-2026-09-21-real-login-wired.md). Lazy:
    // NpgsqlSqlExecutor doesn't open a connection until something actually queries through it, so
    // this registration alone can't reproduce today's Jwt:SigningKey-shaped startup crash even if
    // ConnectionStrings:Postgres is ever missing in an environment.
    builder.Services.AddSingleton<ISqlExecutor>(_ =>
        new NpgsqlSqlExecutor(builder.Configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres is not configured.")));
    builder.Services.AddScoped<IEntityRecordRepository, PostgresEntityRepository>();
    builder.Services.AddUserIdentity();

    // Adventures.Ioc's reflection-based auto-registration for the Bll/Dal/Presenter MvpVm pattern
    // (see Adventures.Common.Tests/MvpVmTests.cs) - picks up UserBll and UserPresenter below.
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
        || string.IsNullOrWhiteSpace(postgresConnection);
    INQuadStore nquadStore = useMemoryStore
        ? new InMemoryNQuadStore()
        : new NpgsqlNQuadStore(postgresConnection!, builder.Configuration["NQuadStore:Table"] ?? "app_n_quads");
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
    if (nquadStore is INQuadStoreInitializer initializer)
    {
        await initializer.InitializeAsync();
    }

    var nquadSeedPath = Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed.nq");
    seeded = await nquadStore.SeedOnceAsync(nquadSeedPath, "baseline");
    // Named, once-only seeds added after the baseline (each ships as its own file, never merged into seed.nq).
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-002-exception-log.nq"), EntityConstants.ExceptionLog.SeedName);
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-003-exception-signature.nq"), EntityConstants.ExceptionLog.SignatureSeedName);
    // The tenant and role model already in the baseline: seed 004 only describes it (schemas, and the User role-assignment relations).
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-004-identity.nq"), EntityConstants.Identity.SeedName);
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-005-identity-required.nq"), EntityConstants.Identity.RequiredSeedName);
    // The content model (pages, posts, categories, tags): new schemas under the schema host, modelled on the BlogEngine admin.
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-006-content.nq"), EntityConstants.Content.SeedName);
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-007-post-taxonomy.nq"), EntityConstants.Content.TaxonomySeedName);
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-008-post-revision.nq"), EntityConstants.Content.RevisionSeedName);
    // The legacy mirror layer: one schema per ported BlogEngine.NET table (generated; see the legacy table migration plan). Schemas only, no data.
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-009-legacy-schemas.nq"), EntityConstants.Legacy.SchemaSeedName);
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-010-legacy-ids.nq"), EntityConstants.Legacy.IdFieldsSeedName);
    // The review state of a collaboration post (Approval, ApprovedBy, ApprovedAt): changed only by the approve actions.
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-013-post-approval.nq"), EntityConstants.Content.ApprovalSeedName);
    // The conversation under a post (comments and decisions).
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-014-comments.nq"), EntityConstants.Content.CommentsSeedName);
    // Collaboration items (review requests and research questions): their own type, never public (not a post).
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-015-collaboration.nq"), CollaborationConstants.SeedName);
    // The Research kind of collaboration item: Status, Sources and Findings.
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-017-research.nq"), CollaborationConstants.ResearchSeedName);
    // The rights of the Admin, Editor, Reviewer and Developer roles (a Rights field on Role and its default values).
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-018-role-rights.nq"), "018-role-rights");
    // The on/off state of the built-in plug-ins (a plug-in with no stored state is on).
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-016-plugins.nq"), PluginConstants.SeedName);
    // The site settings (title, tagline, posts per page, legacy time zone) with their four defaults; an administrator edits them afterwards.
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-011-site-settings.nq"), EntityConstants.Site.SeedName);
    }
    Log.Information("N-Quad store: {Provider} at {Store}{Live}; baseline seed {SeedState}", useMemoryStore ? "memory" : "postgres", LiveDataMode.Describe(postgresConnection), liveData ? " (LIVE DATA)" : "", seeded ? "applied" : "already applied");
    var userQuads = await nquadStore.QueryAsync();
    if (skipSeeding && StartupChecks.FindMissingSchemas(userQuads, [CollaborationConstants.SchemaIri, PluginConstants.SchemaIri]) is { Count: > 0 } missingSchemas)
    {
        await StartupChecks.RunReportingAppAsync(args, missingSchemas, builder.Environment.IsDevelopment(), liveData);
        return;
    }

    var userSchema = SchemaDal.Load(userQuads, EntityConstants.Schema.UserIri);

    builder.Services.AddSingleton<INQuadStore>(nquadStore);
    // Uploaded images: in the same PostgreSQL database as the content (survives a redeploy, travels with the backup); memory for the in-memory development store.
    builder.Services.AddSingleton<IMediaStore>(useMemoryStore ? new InMemoryMediaStore() : new NpgsqlMediaStore(postgresConnection!, builder.Configuration["Media:Table"] ?? "app_media"));
    builder.Services.AddHttpContextAccessor();

    builder.Services.AddNQuadEntityRepository(
        userSchema,
        EntityConstants.User.BaseIri,
        EntityConstants.User.TypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new User(schema));

    // SchemaBll (Adventures.Entities) is auto-registered by AddLifetimeServices above via its
    // reflection scan across every loaded assembly, not just what this host actually uses - ASP.NET
    // Core validates every registered service graph is resolvable at Build() time (Development
    // default), so SchemaEntity/SchemaFieldEntity repositories are needed here even though nothing
    // in this app calls ISchemaBll yet. Reuses the same seeded store; each schema is loaded the
    // same way the User schema above is - via SchemaDal.Load - no hardcoded MetaSchema anymore.
    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.ExceptionLog.SchemaIri),
        EntityConstants.ExceptionLog.BaseIri,
        EntityConstants.ExceptionLog.TypeIri,
        EntityConstants.ExceptionLog.DefaultGraph,
        schema => new ExceptionLogEntry(schema));

    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.ExceptionSignatureEntity.SchemaIri),
        EntityConstants.ExceptionSignatureEntity.BaseIri,
        EntityConstants.ExceptionSignatureEntity.TypeIri,
        EntityConstants.ExceptionSignatureEntity.DefaultGraph,
        schema => new ExceptionSignatureEntry(schema));

    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.Schema.EntityTypeIri),
        EntityConstants.Schema.EntityBaseIri,
        EntityConstants.Schema.EntityTypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new SchemaEntity(schema));
    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.Schema.FieldEntityTypeIri),
        EntityConstants.Schema.FieldEntityBaseIri,
        EntityConstants.Schema.FieldEntityTypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new SchemaFieldEntity(schema));

    // Identity schemas (seed 004): the data is untouched; each schema maps onto the existing predicates. Roles get an admin grid;
    // the rest are read through the relation provider (a user role assignments) and need only their registrations.
    static void AddIdentityEntity<TEntity>(
        IServiceCollection services, IReadOnlyList<NQuad> quads, string schemaIri, string baseIri, string typeIri, Func<EntitySchema, TEntity> factory)
        where TEntity : DynamicEntity =>
        services.AddNQuadEntityRepository(SchemaDal.Load(quads, schemaIri), baseIri, typeIri, EntityConstants.Identity.DefaultGraph, factory);

    AddIdentityEntity(builder.Services, userQuads, EntityConstants.Identity.RoleSchemaIri, EntityConstants.Identity.RoleBaseIri, EntityConstants.Identity.RoleTypeIri, s => new Role(s));
    AddIdentityEntity(builder.Services, userQuads, EntityConstants.Identity.TenantSchemaIri, EntityConstants.Identity.TenantBaseIri, EntityConstants.Identity.TenantTypeIri, s => new Tenant(s));
    AddIdentityEntity(builder.Services, userQuads, EntityConstants.Identity.BlogSchemaIri, EntityConstants.Identity.BlogBaseIri, EntityConstants.Identity.BlogTypeIri, s => new Blog(s));
    AddIdentityEntity(builder.Services, userQuads, EntityConstants.Identity.OrganizationSchemaIri, EntityConstants.Identity.OrganizationBaseIri, EntityConstants.Identity.OrganizationTypeIri, s => new Organization(s));
    AddIdentityEntity(builder.Services, userQuads, EntityConstants.Identity.TenantRoleSchemaIri, EntityConstants.Identity.TenantRoleBaseIri, EntityConstants.Identity.TenantRoleTypeIri, s => new TenantRoleAssignment(s));
    AddIdentityEntity(builder.Services, userQuads, EntityConstants.Identity.OrganizationRoleSchemaIri, EntityConstants.Identity.OrganizationRoleBaseIri, EntityConstants.Identity.OrganizationRoleTypeIri, s => new OrganizationRoleAssignment(s));
    static void AddContentEntity<TEntity>(
        IServiceCollection services, IReadOnlyList<NQuad> quads, string schemaIri, string baseIri, string typeIri, Func<EntitySchema, TEntity> factory)
        where TEntity : DynamicEntity =>
        services.AddNQuadEntityRepository(SchemaDal.Load(quads, schemaIri), baseIri, typeIri, EntityConstants.Content.DefaultGraph, factory);

    AddContentEntity(builder.Services, userQuads, EntityConstants.Content.PageSchemaIri, EntityConstants.Content.PageBaseIri, EntityConstants.Content.PageTypeIri, s => new Page(s));
    AddContentEntity(builder.Services, userQuads, EntityConstants.Content.PostSchemaIri, EntityConstants.Content.PostBaseIri, EntityConstants.Content.PostTypeIri, s => new Post(s));
    AddContentEntity(builder.Services, userQuads, EntityConstants.Content.CategorySchemaIri, EntityConstants.Content.CategoryBaseIri, EntityConstants.Content.CategoryTypeIri, s => new Category(s));
    AddContentEntity(builder.Services, userQuads, EntityConstants.Content.TagSchemaIri, EntityConstants.Content.TagBaseIri, EntityConstants.Content.TagTypeIri, s => new Tag(s));
    AddContentEntity(builder.Services, userQuads, EntityConstants.Content.CommentSchemaIri, EntityConstants.Content.CommentBaseIri, EntityConstants.Content.CommentTypeIri, s => new Comment(s));
    builder.Services.AddScoped<IEntityBll<Comment>>(provider => new EntityBll<Comment>(provider.GetRequiredService<IEntityDal<Comment>>()));
    builder.Services.AddScoped<IConversation, Conversation>();
    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, CollaborationConstants.SchemaIri), CollaborationConstants.BaseIri, CollaborationConstants.TypeIri,
        CollaborationConstants.DefaultGraph, s => new CollaborationItem(s));
    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, PluginConstants.SchemaIri), PluginConstants.BaseIri, PluginConstants.TypeIri,
        CollaborationConstants.DefaultGraph, s => new Plugin(s));
    builder.Services.AddScoped<IEntityBll<Plugin>>(provider => new EntityBll<Plugin>(provider.GetRequiredService<IEntityDal<Plugin>>()));
    builder.Services.AddScoped<IPlugins, Plugins>();
    builder.Services.AddScoped<IRightsResolver, RightsResolver>();
    builder.Services.AddScoped<IRoleRightsEditor, RoleRightsEditor>();
    builder.Services.AddRightsAuthorization();
    builder.Services.AddScoped<IEntityBll<Tenant>>(provider => new EntityBll<Tenant>(provider.GetRequiredService<IEntityDal<Tenant>>()));
    builder.Services.AddScoped<ITenantResolver, TenantResolver>();
    builder.Services.AddScoped<ICollaborationBll, CollaborationBll>();
    builder.Services.AddScoped<IEntityPresenter<CollaborationItem>, CollaborationPresenter>();
    builder.Services.AddScoped<ICollaborationAuthoring, CollaborationAuthoring>();
    builder.Services.AddScoped<CollaborationMigration>();
    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.Site.SettingSchemaIri), EntityConstants.Site.SettingBaseIri, EntityConstants.Site.SettingTypeIri,
        EntityConstants.Site.DefaultGraph, s => new SiteSetting(s));
    builder.Services.AddScoped<IEntityBll<SiteSetting>>(provider => new EntityBll<SiteSetting>(provider.GetRequiredService<IEntityDal<SiteSetting>>()));
    builder.Services.AddScoped<IEntityPresenter<SiteSetting>, SiteSettingPresenter>();
    builder.Services.AddScoped<ISiteSettings, SiteSettings>();
    builder.Services.AddScoped<IPageBll, PageBll>();
    builder.Services.AddScoped<IPostBll, PostBll>();
    builder.Services.AddScoped<IContentAuthoring, ContentAuthoring>();
    builder.Services.AddScoped<IPublicContent, PublicContent>();
    builder.Services.AddScoped<IEntityPresenter<Post>, PostPresenter>();
    builder.Services.AddScoped<IEntityBll<Category>>(provider => new EntityBll<Category>(provider.GetRequiredService<IEntityDal<Category>>()));
    builder.Services.AddScoped<IEntityBll<Tag>>(provider => new EntityBll<Tag>(provider.GetRequiredService<IEntityDal<Tag>>()));
    builder.Services.AddScoped<IEntityPresenter<Category>>(provider => new EntityPresenter<Category>(
        provider.GetRequiredService<IEntityBll<Category>>(), provider.GetRequiredService<EntitySchemaOf<Category>>().Schema, s => new Category(s), provider.GetService<IEntityRelationProvider>()));
    builder.Services.AddScoped<IEntityPresenter<Tag>>(provider => new EntityPresenter<Tag>(
        provider.GetRequiredService<IEntityBll<Tag>>(), provider.GetRequiredService<EntitySchemaOf<Tag>>().Schema, s => new Tag(s), provider.GetService<IEntityRelationProvider>()));
    builder.Services.AddScoped<IEntityPresenter<Page>>(provider => new EntityPresenter<Page>(
        provider.GetRequiredService<IPageBll>(), provider.GetRequiredService<EntitySchemaOf<Page>>().Schema, s => new Page(s), provider.GetService<IEntityRelationProvider>()));
    builder.Services.AddNQuadRelations();
    builder.Services.AddNQuadRelationWriter();
    builder.Services.AddScoped<IEntityBll<Role>>(provider => new EntityBll<Role>(provider.GetRequiredService<IEntityDal<Role>>()));
    builder.Services.AddScoped<IEntityPresenter<Role>>(provider => new RolePresenter(
        provider.GetRequiredService<IEntityBll<Role>>(), provider.GetRequiredService<EntitySchemaOf<Role>>(), provider.GetService<IEntityRelationProvider>()));

    var app = builder.Build();

    if (!skipSeeding)
    {
        // Improved default rights for roles still at their first shipped values (a seed cannot supersede a stored value); an edited role is left alone.
        using var upgradeScope = app.Services.CreateScope();
        var upgraded = await RoleRightsUpgrade.ApplyAsync(upgradeScope.ServiceProvider.GetRequiredService<IEntityDal<Role>>());

        if (upgraded > 0)
        {
            Log.Information("Upgraded the default rights of {Count} role(s).", upgraded);
        }
    }

    // First in the pipeline: everything after it (request logging, the exception handler, controllers) logs under the id.
    app.UseCorrelationId();
    app.UseSecurityHeaders(app.Environment.IsDevelopment());
    app.Use(async (context, next) =>
    {
        using (Serilog.Context.LogContext.PushProperty(CorrelationIdMiddleware.LogPropertyName, CorrelationIdMiddleware.Get(context)))
        {
            await next(context);
        }
    });
    app.UseSerilogRequestLogging();

    // Configure the HTTP request pipeline.
    // UseCors must come before any Map* calls so it runs ahead of terminal
    // middleware (health checks, controllers) and can attach CORS headers.
    // The root stays reachable over plain HTTP: SmarterASP's free-SSL preflight requests it
    // without following redirects, so redirecting "/" would fail issue and renewal.
    app.UseWhen(context => !context.Request.Path.Equals("/"), branch => branch.UseHttpsRedirection());
    app.UseCors(AngularCorsPolicy);
    app.UseRateLimiter();

    // One handler in every environment, so what a developer sees is what production does: the full exception goes to the
    // log file and the exception log, the client gets a shielded body with a reference (see UnhandledExceptionHandler).
    // Without a handler an exception anywhere in the pipeline (authentication and authorization included) would fall
    // through to IIS's own bare error page with nothing logged.
    app.UseExceptionHandler(errorApp => errorApp.Run(UnhandledExceptionHandler.HandleAsync));

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi().AllowAnonymous();
    }

    app.MapDefaultEndpoints();

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();

    if (app.Environment.IsDevelopment())
    {
        // Test aid, not a feature: throws on purpose so the exception log, the header warning and the Exceptions screen
        // can be exercised end to end. Development only (not mapped in production), administrators only.
        static IResult ThrowDeliberately() => throw new InvalidOperationException("Deliberate test exception from /api/dev/throw.");
        app.MapGet("/api/dev/throw", ThrowDeliberately)
            .RequireAuthorization(WellKnownClaims.TenantAdminPolicy)
            .ExcludeFromDescription();
    }

    // SmarterASP's free-SSL request (issue and renewal) requires the domain root to return HTTP 200.
    app.MapGet("/", () => Results.Ok(new { service = "AiBlogResearch.WebApi", status = "ok" })).AllowAnonymous()
        .ExcludeFromDescription();

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
