// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - security findings F-1 to F-3 fixed in this file or in code it uses, covered by tests. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
// Rebuilt on the shared hosting and the MCP gateway library (R4 of the host reuse review, 2026-11-24): this file names the features this server uses; the logging, startup checks, pipeline and protocol are Foundation.
using Adventures.Mcp.WebApi;
using Adventures.Security;
using Adventures.WebApi;
using McpServer.WebApi.BlogAi;
using McpServer.WebApi.Tools;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Missing configuration is reported, not fatal (same 503 reporting app as the API); this host keeps no database of its own.
var startupProblems = StartupChecks.Find(builder.Configuration, builder.Environment.IsDevelopment(), needsDatabase: false);
if (startupProblems.Count > 0)
{
    await StartupChecks.RunReportingAppAsync(args, startupProblems, builder.Environment.IsDevelopment(), liveData: false);
    return;
}

builder.AddServiceDefaults();
builder.Host.UseAdventuresSerilog("mcp");

builder.Services.AddControllers().AddMcpControllers();

builder.Services.AddSharedJwtAuthentication(builder.Configuration);
builder.Services.AddRequestHardening(builder.Configuration);

// The gateway: protocol, manifest cache, forwarding to the API (Api:BaseUrl) with the caller's token. This server's own research tools (read-only, legacy database) sit beside it.
builder.Services.AddMcpGateway(new McpGatewayOptions { AdditionalScopes = [ResearchTools.Scope] });
builder.Services.AddSingleton<IBlogAiReader, BlogAiReader>();
// The research tools this server adds (replaces the gateway default registry, which is built from whatever IMcpOnlyTool services are registered).
builder.Services.AddSingleton(sp => new McpOnlyToolRegistry(ResearchTools.Create(sp.GetRequiredService<IBlogAiReader>())));

var app = builder.Build();

app.UseAdventuresPreamble();
app.MapGet("/", () => Results.Text("mcp ok")).AllowAnonymous().ExcludeFromDescription();

app.MapDefaultEndpoints();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposes the top-level Program to WebApplicationFactory<Program> in McpServer.WebApi.Tests
// (integration test needs the whole auth/authorization pipeline wired up, not just the controller
// action in isolation - that's the actual thing this service exists to prove out).
public partial class Program;
