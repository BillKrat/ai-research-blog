var builder = DistributedApplication.CreateBuilder(args);

var webApi = builder.AddProject<Projects.AiBlogResearch_WebApi>("webapi");

builder.AddNpmApp("angular", "../client/ai-blog-research-ui", "start")
    .WithReference(webApi)
    .WithEnvironment("BACKEND_URL", webApi.GetEndpoint("https"))
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithExternalHttpEndpoints();

builder.Build().Run();
