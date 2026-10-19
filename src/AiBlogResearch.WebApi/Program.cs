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
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

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

    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
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

    builder.Services.AddOptions<M2MClientsOptions>()
        .Bind(builder.Configuration.GetSection(M2MClientsOptions.SectionName));
    builder.Services.AddSingleton<IClientSecretHasher, ClientSecretHasher>();
    builder.Services.AddSingleton<IClientCredentialStore, InMemoryClientCredentialStore>();
    builder.Services.AddScopeAuthorization("mcp.postgres.query", "mcp.filesearch.search", AiBlogResearch.WebApi.Controllers.McpDiagnosticsController.RequiredScope);
    builder.Services.AddRoleAuthorization(WellKnownClaims.TenantAdminRole);

    // McpServer:BaseUrl -> mcp.global-webnet.com. HealthController calls this over M2M auth (minting
    // its own "mcp-host" token in-process via IJwtTokenService, since this app IS the token issuer -
    // see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md) to prove the cross-site M2M pipeline end
    // to end. A short timeout keeps a slow/unreachable mcp site from hanging /api/health itself.
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers is marked experimental; it is the supported way to opt one client out.
    builder.Services.AddHttpClient("McpServer", (services, client) =>
    {
        var baseUrl = services.GetRequiredService<IConfiguration>()["McpServer:BaseUrl"]
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
    builder.Services.AddScoped<IDependencyProbes, DependencyProbes>();

    // Adventures.Data/Adventures.Identity: registered so IUserAccountService is available to
    // AuthController, which uses it for the real login (see
    // docs/artifacts/Claude-2026-09-21-real-login-wired.md). Lazy:
    // NpgsqlSqlExecutor doesn't open a connection until something actually queries through it, so
    // this registration alone can't reproduce today's Jwt:SigningKey-shaped startup crash even if
    // ConnectionStrings:Postgres is ever missing in an environment.
    builder.Services.AddSingleton<ISqlExecutor>(_ =>
        new NpgsqlSqlExecutor(builder.Configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres is not configured.")));
    builder.Services.AddScoped<IEntityRepository, PostgresEntityRepository>();
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
    if (nquadStore is INQuadStoreInitializer initializer)
    {
        await initializer.InitializeAsync();
    }

    var nquadSeedPath = Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed.nq");
    var seeded = await nquadStore.SeedOnceAsync(nquadSeedPath, "baseline");
    // Named, once-only seeds added after the baseline (each ships as its own file, never merged into seed.nq).
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-002-exception-log.nq"), EntityConstants.ExceptionLog.SeedName);
    await nquadStore.SeedOnceAsync(
        Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed-003-exception-signature.nq"), EntityConstants.ExceptionLog.SignatureSeedName);
    Log.Information("N-Quad store: {Provider}; baseline seed {SeedState}", useMemoryStore ? "memory" : "postgres", seeded ? "applied" : "already applied");
    var userQuads = await nquadStore.QueryAsync();
    var userSchema = SchemaDal.Load(userQuads, EntityConstants.Schema.UserIri);

    builder.Services.AddSingleton<INQuadStore>(nquadStore);
    // The audit trail records who made each change: the signed-in user for a request, "system" otherwise.
    builder.Services.AddHttpContextAccessor();
    static string? CurrentActor(IServiceProvider services) =>
        services.GetService<IHttpContextAccessor>()?.HttpContext?.User.Identity?.Name;

    builder.Services.AddNQuadEntityRepository(
        userSchema,
        EntityConstants.User.BaseIri,
        EntityConstants.User.TypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new User(schema),
        CurrentActor);

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
        schema => new ExceptionLogEntry(schema),
        CurrentActor);

    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.ExceptionSignatureEntity.SchemaIri),
        EntityConstants.ExceptionSignatureEntity.BaseIri,
        EntityConstants.ExceptionSignatureEntity.TypeIri,
        EntityConstants.ExceptionSignatureEntity.DefaultGraph,
        schema => new ExceptionSignatureEntry(schema),
        CurrentActor);

    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.Schema.EntityTypeIri),
        EntityConstants.Schema.EntityBaseIri,
        EntityConstants.Schema.EntityTypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new SchemaEntity(schema),
        CurrentActor);
    builder.Services.AddNQuadEntityRepository(
        SchemaDal.Load(userQuads, EntityConstants.Schema.FieldEntityTypeIri),
        EntityConstants.Schema.FieldEntityBaseIri,
        EntityConstants.Schema.FieldEntityTypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new SchemaFieldEntity(schema),
        CurrentActor);

    var app = builder.Build();

    // First in the pipeline: everything after it (request logging, the exception handler, controllers) logs under the id.
    app.UseCorrelationId();
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

    // One handler in every environment, so what a developer sees is what production does: the full exception goes to the
    // log file and the exception log, the client gets a shielded body with a reference (see UnhandledExceptionHandler).
    // Without a handler an exception anywhere in the pipeline (authentication and authorization included) would fall
    // through to IIS's own bare error page with nothing logged.
    app.UseExceptionHandler(errorApp => errorApp.Run(UnhandledExceptionHandler.HandleAsync));

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
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
    app.MapGet("/", () => Results.Ok(new { service = "AiBlogResearch.WebApi", status = "ok" }))
        .ExcludeFromDescription();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "AiBlogResearch.WebApi terminated unexpectedly during startup");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
