using Adventures.Mcp.WebApi;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Adventures.Blog.Legacy.Research;
using Adventures.Blog.Legacy.Research;
using Xunit;

namespace McpServer.WebApi.Tests.Controllers;

/// <summary>
/// Tool plan stage 3 (2026-11-21): the research tools are marked <see cref="IMcpOnlyTool"/> and sit behind their own registry. These tests keep
/// that list read-only by construction: a tool can only be given the legacy reader, the reader has no write method, the project references no
/// store project, and the registry refuses a tool with no scope or a name already taken.
/// </summary>
public sealed class McpOnlyToolGuardTests
{
    private const string Scope = "blogai.read";

    private sealed class FakeReader(bool isConfigured, string answer = "[]") : IBlogAiReader
    {
        public bool IsConfigured => isConfigured;

        public string? LastQuery { get; private set; }

        public IReadOnlyDictionary<string, string?>? LastArguments { get; private set; }

        public (string Table, int Offset, int Limit)? LastRows { get; private set; }

        public Func<Exception>? Throw { get; init; }

        public Task<string> RunAsync(BlogAiQuery query, IReadOnlyDictionary<string, string?> arguments, CancellationToken cancellationToken)
        {
            if (Throw is not null)
            {
                throw Throw();
            }

            (LastQuery, LastArguments) = (query.Name, arguments);
            return Task.FromResult(answer);
        }

        public Task<string> ReadRowsAsync(BlogAiTable table, int offset, int limit, CancellationToken cancellationToken)
        {
            LastRows = (table.Name, offset, limit);
            return Task.FromResult(answer);
        }
    }

    private static McpOnlyToolRegistry Registry(IBlogAiReader? reader = null) => new(ResearchTools.Create(reader ?? new FakeReader(true)));

    private static JsonElement Args(object value) => JsonSerializer.SerializeToElement(value);

    [Fact]
    public void TheRegistry_HoldsEveryCatalogQuery_AndTheRowsTool()
    {
        var names = Registry().Tools.Select(t => t.Name).ToList();

        Assert.Equal(BlogAiCatalog.Queries.Select(q => q.Name).Append("blogai_rows"), names);
        Assert.Equal(names.Count, names.Distinct().Count());
    }

    [Fact]
    public void EveryTool_NeedsTheBlogAiScope_AndSaysItIsReadOnly()
    {
        Assert.All(Registry().Tools, tool =>
        {
            Assert.Equal(Scope, tool.RequiredScope);
            Assert.EndsWith("Read-only.", tool.Description.TrimEnd());
            Assert.Equal("object", tool.InputSchema["type"]!.GetValue<string>());
        });
    }

    [Fact]
    public void ARegistry_ListsNothingWithoutTheScope_AndEverythingWithIt()
    {
        var registry = Registry();

        Assert.Empty(registry.VisibleTo(new HashSet<string> { "content.draft", "mcp.diagnostics.read" }));
        Assert.Equal(registry.Tools.Count, registry.VisibleTo(new HashSet<string> { Scope }).Count);
        Assert.Null(registry.Find("create_draft_post"));
        Assert.NotNull(registry.Find("blogai_posts"));
    }

    [Fact]
    public void ARegistry_RefusesADuplicateName_AndATool_WithNoScope()
    {
        var reader = new FakeReader(true);
        var tools = ResearchTools.Create(reader).ToList();

        Assert.Throws<ArgumentException>(() => new McpOnlyToolRegistry([tools[0], tools[0]]));
        Assert.Throws<ArgumentException>(() => new McpOnlyToolRegistry([new NoScopeTool()]));
    }

    private sealed class NoScopeTool : IMcpOnlyTool
    {
        public string Name => "blogai_noscope";

        public string Description => "Read-only.";

        public string RequiredScope => string.Empty;

        public System.Text.Json.Nodes.JsonObject InputSchema => new() { ["type"] = "object" };

        public Task<McpToolOutcome> InvokeAsync(JsonElement arguments, CancellationToken cancellationToken) => Task.FromResult(new McpToolOutcome("x", false));
    }

    [Fact]
    public void AnMcpOnlyTool_CanOnlyBeGivenTheLegacyReader()
    {
        // A tool that holds an HTTP client, the API client, a store or the configuration could write; the only thing it may be built from is
        // the read-only legacy reader (and the catalogue query it runs).
        var allowed = new[] { typeof(IBlogAiReader), typeof(BlogAiQuery) };
        var tools = typeof(Adventures.Blog.Legacy.Research.ResearchTools).Assembly.GetTypes().Where(t => typeof(IMcpOnlyTool).IsAssignableFrom(t) && t is { IsClass: true, IsAbstract: false }).ToList();

        Assert.NotEmpty(tools);
        foreach (var tool in tools)
        {
            foreach (var constructor in tool.GetConstructors(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance))
            {
                Assert.All(constructor.GetParameters(), p => Assert.True(allowed.Contains(p.ParameterType), $"{tool.Name} takes {p.ParameterType.Name}, which could write."));
            }
        }
    }

    [Fact]
    public void TheLegacyReader_HasNoWriteMethod()
    {
        var members = typeof(IBlogAiReader).GetMethods().Select(m => m.Name).OrderBy(n => n, StringComparer.Ordinal).ToList();

        Assert.Equal(["ReadRowsAsync", "RunAsync", "get_IsConfigured"], members);
    }

    [Fact]
    public void TheMcpProject_ReferencesNoStoreProject_OnlyTheSecurityAndWebApiLibraries()
    {
        var csproj = File.ReadAllText(FindUp("src/McpServer.WebApi/McpServer.WebApi.csproj"));
        var references = Regex.Matches(csproj, "<ProjectReference Include=\"([^\"]+)\"").Select(m => Path.GetFileNameWithoutExtension(m.Groups[1].Value.Replace('\\', '/'))).OrderBy(n => n).ToList();

        Assert.Equal(["Adventures.Blog.Legacy.Research", "Adventures.Mcp.WebApi", "Adventures.Security", "Adventures.Security.AspNetCore", "Adventures.WebApi", "AiBlogResearch.ServiceDefaults"], references);

        var packages = Regex.Matches(csproj, "<PackageReference Include=\"([^\"]+)\"").Select(m => m.Groups[1].Value).OrderBy(n => n).ToList();
        Assert.Empty(packages); // R5: the SQL Server client lives in the optional research module, not in the host

        // the module itself reaches nothing but the gateway contract and SQL Server through its own reader
        var module = File.ReadAllText(FindUp("Adventures.Foundation/src/Adventures.Blog.Legacy.Research/Adventures.Blog.Legacy.Research.csproj"));
        Assert.Equal(["Adventures.Mcp.WebApi"], Regex.Matches(module, "<ProjectReference Include=\"([^\"]+)\"").Select(m => Path.GetFileNameWithoutExtension(m.Groups[1].Value.Replace('\\', '/'))).OrderBy(n => n).ToList());
        Assert.Equal(["Microsoft.Data.SqlClient", "System.Security.Cryptography.Pkcs"], Regex.Matches(module, "<PackageReference Include=\"([^\"]+)\"").Select(m => m.Groups[1].Value).OrderBy(n => n).ToList());
    }

    private static string FindUp(string relative)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, relative);
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException(relative);
    }

    [Fact]
    public async Task AQueryTool_PassesItsArgumentsToTheReader_AndAnswersTheRows()
    {
        var reader = new FakeReader(true, """[{"postId":"1"}]""");

        var outcome = await Registry(reader).Find("blogai_posts")!.InvokeAsync(Args(new { limit = 5 }), CancellationToken.None);

        Assert.False(outcome.IsError);
        Assert.Equal("""[{"postId":"1"}]""", outcome.Text);
        Assert.Equal("blogai_posts", reader.LastQuery);
        Assert.Equal("5", reader.LastArguments!["limit"]);
    }

    [Fact]
    public async Task AQueryTool_SaysSo_WhenTheDatabaseIsNotConfigured()
    {
        var outcome = await Registry(new FakeReader(false)).Find("blogai_tables")!.InvokeAsync(Args(new { }), CancellationToken.None);

        Assert.True(outcome.IsError);
        Assert.Contains("ConnectionStrings:BlogAi", outcome.Text);
    }

    [Fact]
    public async Task AQueryTool_ReportsABadArgument_ByItsMessage()
    {
        var reader = new FakeReader(true) { Throw = () => new BlogAiArgumentException("table must be a name") };

        var outcome = await Registry(reader).Find("blogai_columns")!.InvokeAsync(Args(new { table = "x y" }), CancellationToken.None);

        Assert.True(outcome.IsError);
        Assert.Equal("table must be a name", outcome.Text);
    }

    [Theory]
    [InlineData("be_Users; DROP TABLE be_Posts")]
    [InlineData("AspNetUsers")]
    [InlineData("")]
    public async Task TheRowsTool_RefusesAnyTableNotOnTheList(string table)
    {
        var reader = new FakeReader(true);

        var outcome = await Registry(reader).Find("blogai_rows")!.InvokeAsync(Args(new { table }), CancellationToken.None);

        Assert.True(outcome.IsError);
        Assert.Null(reader.LastRows);
    }

    [Fact]
    public async Task TheRowsTool_PassesTheTableAndPaging_ToTheReader()
    {
        var reader = new FakeReader(true);
        var table = BlogAiTables.All[0].Name;

        var outcome = await Registry(reader).Find("blogai_rows")!.InvokeAsync(Args(new { table, offset = 10, limit = 20 }), CancellationToken.None);

        Assert.False(outcome.IsError);
        Assert.Equal((table, 10, 20), reader.LastRows);
    }
}
