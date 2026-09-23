var builder = DistributedApplication.CreateBuilder(args);

var webApi = builder.AddProject<Projects.AiBlogResearch_WebApi>("webapi");

var mcpServer = builder.AddProject<Projects.McpServer_WebApi>("mcpserver");

builder.AddNpmApp("angular", "../client/ai-blog-research-ui", "start")
    .WithReference(webApi)
    .WithReference(mcpServer)
    .WithEnvironment("BACKEND_URL", webApi.GetEndpoint("https"))
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithExternalHttpEndpoints();

builder.Build().Run();
