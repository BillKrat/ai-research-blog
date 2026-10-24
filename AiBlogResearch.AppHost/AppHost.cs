var builder = DistributedApplication.CreateBuilder(args);

var webApi = builder.AddProject<Projects.AiBlogResearch_WebApi>("webapi");

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

var mcpServer = builder.AddProject<Projects.McpServer_WebApi>("mcpserver");

builder.AddNpmApp("angular", "../client/ai-blog-research-ui", "start")
    .WithReference(webApi)
    .WithReference(mcpServer)
    .WithEnvironment("BACKEND_URL", webApi.GetEndpoint("https"))
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithExternalHttpEndpoints();

builder.Build().Run();
