var builder = DistributedApplication.CreateBuilder(args);

var webApi = builder.AddProject<Projects.AiBlogResearch_WebApi>("webapi");

// The "https-live" launch profile sets LiveData:Enabled: the local API then uses the production store (LiveData:ConnectionString in the
// WebApi user-secrets), without seeding, and the client shows a banner. See LiveDataMode in the WebApi.
if (string.Equals(builder.Configuration["LiveData:Enabled"], "true", StringComparison.OrdinalIgnoreCase))
{
    webApi.WithEnvironment("LiveData__Enabled", "true");
}

var mcpServer = builder.AddProject<Projects.McpServer_WebApi>("mcpserver");

builder.AddNpmApp("angular", "../client/ai-blog-research-ui", "start")
    .WithReference(webApi)
    .WithReference(mcpServer)
    .WithEnvironment("BACKEND_URL", webApi.GetEndpoint("https"))
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithExternalHttpEndpoints();

builder.Build().Run();
