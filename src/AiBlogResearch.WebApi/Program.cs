using Adventures.Data;
using Adventures.Data.NQuad;
using Adventures.Entities;
using Adventures.Identity;
using Adventures.Ioc.Extensions;
using Adventures.Security;
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

    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .WriteTo.Console()
        .WriteTo.File(
            Path.Combine(AppContext.BaseDirectory, "logs", "webapi-.log"),
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
    builder.Services.AddScopeAuthorization("mcp.postgres.query", "mcp.filesearch.search");

    // McpServer:BaseUrl -> mcp.global-webnet.com. HealthController calls this over M2M auth (minting
    // its own "mcp-host" token in-process via IJwtTokenService, since this app IS the token issuer -
    // see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md) to prove the cross-site M2M pipeline end
    // to end. A short timeout keeps a slow/unreachable mcp site from hanging /api/health itself.
    builder.Services.AddHttpClient("McpServer", (services, client) =>
    {
        var baseUrl = services.GetRequiredService<IConfiguration>()["McpServer:BaseUrl"]
            ?? throw new InvalidOperationException("McpServer:BaseUrl is not configured.");
        client.BaseAddress = new Uri(baseUrl);
        client.Timeout = TimeSpan.FromSeconds(10);
    });

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
    // InMemoryNQuadStore, seeded from seed.nq at startup: no real persistence yet, matches "start
    // simple" for this stage - a Postgres-backed INQuadStore is a later swap, not decided here.
    var nquadStore = new InMemoryNQuadStore();
    var nquadSeedPath = Path.Combine(AppContext.BaseDirectory, "Sql", "seed", "seed.nq");
    await nquadStore.SeedFromFileAsync(nquadSeedPath);
    var userQuads = await nquadStore.QueryAsync();
    var userSchema = SchemaDal.Load(userQuads, EntityConstants.Schema.UserIri);

    builder.Services.AddSingleton<INQuadStore>(nquadStore);
    builder.Services.AddSingleton(userSchema);
    builder.Services.AddScoped<IEntityRepository<User>>(services => new NQuadEntityRepository<User>(
        services.GetRequiredService<INQuadStore>(),
        services.GetRequiredService<EntitySchema>(),
        EntityConstants.User.BaseIri,
        EntityConstants.User.TypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new User(schema)));

    // SchemaBll (Adventures.Entities) is auto-registered by AddLifetimeServices above via its
    // reflection scan across every loaded assembly, not just what this host actually uses - ASP.NET
    // Core validates every registered service graph is resolvable at Build() time (Development
    // default), so SchemaEntity/SchemaFieldEntity repositories are needed here even though nothing
    // in this app calls ISchemaBll yet. Reuses the same seeded store; each schema is loaded the
    // same way the User schema above is - via SchemaDal.Load - no hardcoded MetaSchema anymore.
    var schemaEntitySchema = SchemaDal.Load(userQuads, EntityConstants.Schema.EntityTypeIri);
    var schemaFieldEntitySchema = SchemaDal.Load(userQuads, EntityConstants.Schema.FieldEntityTypeIri);
    builder.Services.AddScoped<IEntityRepository<SchemaEntity>>(services => new NQuadEntityRepository<SchemaEntity>(
        services.GetRequiredService<INQuadStore>(),
        schemaEntitySchema,
        EntityConstants.Schema.EntityBaseIri,
        EntityConstants.Schema.EntityTypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new SchemaEntity(schema)));
    builder.Services.AddScoped<IEntityRepository<SchemaFieldEntity>>(services => new NQuadEntityRepository<SchemaFieldEntity>(
        services.GetRequiredService<INQuadStore>(),
        schemaFieldEntitySchema,
        EntityConstants.Schema.FieldEntityBaseIri,
        EntityConstants.Schema.FieldEntityTypeIri,
        EntityConstants.User.DefaultGraph,
        schema => new SchemaFieldEntity(schema)));

    var app = builder.Build();

    app.UseSerilogRequestLogging();

    // Configure the HTTP request pipeline.
    // UseCors must come before any Map* calls so it runs ahead of terminal
    // middleware (health checks, controllers) and can attach CORS headers.
    app.UseHttpsRedirection();
    app.UseCors(AngularCorsPolicy);

    if (app.Environment.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
        app.MapOpenApi();
    }
    else
    {
        // Without this, an unhandled exception anywhere in the pipeline below (including inside
        // authentication/authorization, which run on every request) falls through to IIS's own
        // bare error page - no JSON body, no log entry, nothing to diagnose from. This logs the
        // full exception and returns a minimal problem-details body instead.
        app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
        {
            var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
            Log.Error(exception, "Unhandled exception handling {Method} {Path}", context.Request.Method, context.Request.Path);

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(new
            {
                status = 500,
                title = "An unexpected error occurred.",
            });
        }));
    }

    app.MapDefaultEndpoints();

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();

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
