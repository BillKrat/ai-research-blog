// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - security findings F-1 to F-3 fixed in this file or in code it uses, covered by tests. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Security;
using Adventures.WebApi;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddControllers();

builder.Services.AddSharedJwtAuthentication(builder.Configuration);
builder.Services.AddRequestHardening(builder.Configuration);
builder.Services.AddScopeAuthorization("mcp.hello", McpServer.WebApi.Controllers.DiagnosticsController.RequiredScope, McpServer.WebApi.Controllers.McpController.AuthoringScope, McpServer.WebApi.Controllers.McpController.BlogAiScope);
builder.Services.AddSingleton<McpServer.WebApi.BlogAi.IBlogAiReader, McpServer.WebApi.BlogAi.BlogAiReader>();

// The API owns the exception store and the log files; the diagnostics tool asks it (Api:BaseUrl), carrying the request id.
builder.Services.AddHttpClient(McpServer.WebApi.Controllers.DiagnosticsController.ApiClientName, (services, client) =>
{
    client.BaseAddress = new Uri(Adventures.WebApi.SiteDomain.ApiBaseUrl(services.GetRequiredService<IConfiguration>(), "https://api.global-webnet.com/")!);
    client.Timeout = TimeSpan.FromSeconds(15);
}).AddCorrelationIdHandler();

builder.Services.AddCorrelationId();
builder.Services.AddScoped<McpServer.WebApi.DiagnosticsApiClient>();

var app = builder.Build();

app.UseCorrelationId();
app.UseSecurityHeaders(app.Environment.IsDevelopment());
// The root stays reachable over plain HTTP and answers 200: SmarterASP's free-SSL preflight requests it without following
// redirects, so redirecting or 404ing "/" makes issue and renewal fail (same rule as AiBlogResearch.WebApi; OI-1).
app.UseWhen(context => !context.Request.Path.Equals("/"), branch => branch.UseHttpsRedirection());
app.MapGet("/", () => Results.Text("mcp ok")).AllowAnonymous().ExcludeFromDescription();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    // Mirrors AiBlogResearch.WebApi's pipeline test incident (2026-09-19; history in docs/Claude-architecture-decisions.md):
    // an unhandled exception here would otherwise fall through to IIS's bare error page with no
    // trace anywhere. stdoutLogEnabled in web.config is this project's diagnostic trail instead of
    // Serilog, since this service has no file-logging dependency of its own.
    app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new
        {
            status = 500,
            title = "An unexpected error occurred.",
            correlationId = CorrelationIdMiddleware.Get(context),
        });
    }));
}

app.MapDefaultEndpoints();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposes the top-level Program to WebApplicationFactory<Program> in McpServer.WebApi.Tests
// (integration test needs the whole auth/authorization pipeline wired up, not just the controller
// action in isolation - that's the actual thing this service exists to prove out).
public partial class Program;
