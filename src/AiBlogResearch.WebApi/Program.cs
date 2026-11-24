// The whole host is its name and the features it uses (R1 to R6 of the host reuse review, then the last wiring move): the start-up, store, identity, platform
// services and pipeline are Adventures.Hosting. See docs/artifacts/Claude-2026-11-24-r7-api-host-composition.md.
using Adventures.Blog;
using Adventures.Collaboration;
using Adventures.Entities;
using Adventures.Hosting;
using Adventures.MEF;

await ApiHost.RunAsync(args, new ApiHostOptions
{
    ServiceName = "AiBlogResearch.WebApi",
    HostAssembly = typeof(Program).Assembly,
    AssemblyPrefix = "AiBlogResearch",
    Seeds = [.. DiagnosticsSeeds.All, .. IdentitySeeds.All, .. BlogSeeds.All, .. Adventures.Blog.Legacy.LegacySeeds.All, .. CollaborationSeeds.All, .. PluginSeeds.All],
    RequiredSchemas = [CollaborationConstants.SchemaIri, PluginConstants.SchemaIri, PluginConstants.SettingSchemaIri, WidgetConstants.SchemaIri, BlogConstants.Content.VisitorCommentSchemaIri],
    AddServiceDefaults = builder => builder.AddServiceDefaults(),
    MapDefaultEndpoints = app => app.MapDefaultEndpoints(),
});

// Lets the test host (WebApplicationFactory) boot the real startup.
public partial class Program;
