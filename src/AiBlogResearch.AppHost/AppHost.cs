// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
var builder = DistributedApplication.CreateBuilder(args);

// The child projects use their own "https" launch profile whatever profile the AppHost was started with: Aspire otherwise looks
// for a child profile of the AppHost's name ("https-live" has none) and falls back to "http", which has no https endpoint for BACKEND_URL.
var webApi = builder.AddProject<Projects.AiBlogResearch_WebApi>("webapi", launchProfileName: "https");

// The "https-live" launch profile sets LiveData:Enabled: the local API then uses the production store (ConnectionStrings:LiveData in the
// WebApi user-secrets), without seeding, and the client shows a banner. See LiveDataMode in the WebApi.
var liveDataOn = string.Equals(builder.Configuration["LiveData:Enabled"], "true", StringComparison.OrdinalIgnoreCase);
if (liveDataOn)
{
    webApi.WithEnvironment("LiveData__Enabled", "true");
}

// Says in the AppHost console which database the run is about to use (a plain "dotnet run" or the default profile is not live data).
Console.WriteLine(liveDataOn
    ? "AppHost: LIVE DATA profile is on - the WebApi will use ConnectionStrings:LiveData (the production store)."
    : "AppHost: normal profile - the WebApi uses ConnectionStrings:Postgres. Start the 'https-live' launch profile for live data.");

var mcpServer = builder.AddProject<Projects.McpServer_WebApi>("mcpserver", launchProfileName: "https");

builder.AddNpmApp("angular", "../../client/ai-blog-research-ui", "start")
    .WithReference(webApi)
    .WithReference(mcpServer)
    .WithEnvironment("BACKEND_URL", webApi.GetEndpoint("https"))
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithExternalHttpEndpoints();

builder.Build().Run();
