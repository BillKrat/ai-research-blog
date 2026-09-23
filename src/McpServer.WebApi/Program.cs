using Adventures.Security;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddControllers();

builder.Services.AddSharedJwtAuthentication(builder.Configuration);
builder.Services.AddScopeAuthorization("mcp.hello");

var app = builder.Build();

app.UseHttpsRedirection();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    // Mirrors AiBlogResearch.WebApi's pipeline test incident (docs/SESSION_HANDOFF.md, 2026-09-19):
    // an unhandled exception here would otherwise fall through to IIS's bare error page with no
    // trace anywhere. stdoutLogEnabled in web.config is this project's diagnostic trail instead of
    // Serilog, since this service has no file-logging dependency of its own.
    app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new { status = 500, title = "An unexpected error occurred." });
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
