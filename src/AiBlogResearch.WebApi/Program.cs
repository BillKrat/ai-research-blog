using Adventures.Data;
using Adventures.Identity;
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

    // Adventures.Data/Adventures.Identity: registered so IUserAccountService is available for
    // verification and for AuthController to switch to later (see docs/SESSION_HANDOFF.md,
    // "Adventures.Identity published" - deliberately not wired into AuthController yet). Lazy:
    // NpgsqlSqlExecutor doesn't open a connection until something actually queries through it, so
    // this registration alone can't reproduce today's Jwt:SigningKey-shaped startup crash even if
    // ConnectionStrings:Postgres is ever missing in an environment.
    builder.Services.AddSingleton<ISqlExecutor>(_ =>
        new NpgsqlSqlExecutor(builder.Configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres is not configured.")));
    builder.Services.AddScoped<IEntityRepository, PostgresEntityRepository>();
    builder.Services.AddUserIdentity();

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
