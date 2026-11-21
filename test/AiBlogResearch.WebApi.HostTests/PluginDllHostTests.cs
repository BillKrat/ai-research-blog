using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using Adventures.Entities;
using Adventures.MEF;
using Adventures.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// The developer-sample proof: a plug-in built as a separate DLL (its own API, tool, setting and event handler) is loaded from a plug-in directory by
/// the real host, only after its hash is on the approved list, and is switched on and off per tenant like any plug-in.
/// </summary>
public sealed class PluginDllHostTests : IDisposable
{
    private const string Dll = "Adventures.MEF.SampleWebPlugin.dll";

    private sealed class TwoTenants : ITenantResolver
    {
        public Task<CurrentTenant> ResolveAsync(string? host, string? fallbackDomain = null, CancellationToken cancellationToken = default)
        {
            var name = (host ?? string.Empty).Split(':')[0].ToLowerInvariant();
            return Task.FromResult(name is "acme.test" or "other.test"
                ? new CurrentTenant(name.Split('.')[0] + "-id", name, name, host ?? string.Empty, TenantMatch.Domain)
                : new CurrentTenant(null, null, null, host ?? string.Empty, TenantMatch.None));
        }
    }

    private readonly string _directory = Path.Combine(Path.GetTempPath(), "adv-hostplug-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        try
        {
            Directory.Delete(_directory, recursive: true);
        }
        catch (IOException)
        {
            // a loaded DLL can keep its file
        }
    }

    private void PlaceSample(bool approved)
    {
        Directory.CreateDirectory(_directory);
        var source = Path.Combine(AppContext.BaseDirectory, "sample-web-plugin");
        foreach (var file in Directory.GetFiles(source))
        {
            File.Copy(file, Path.Combine(_directory, Path.GetFileName(file)), overwrite: true);
        }

        var hash = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(Path.Combine(_directory, Dll))));
        File.WriteAllText(Path.Combine(_directory, PluginDirectoryOptions.ApprovedFileName), approved ? JsonSerializer.Serialize(new Dictionary<string, string> { [Dll] = hash }) : "{}");
    }

    private WebApplicationFactory<Program> Host() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            builder.UseSetting("Plugins:Directory", _directory);
            builder.ConfigureTestServices(services => services.AddScoped<ITenantResolver>(_ => new TwoTenants()));
        });

    private static HttpClient As(WebApplicationFactory<Program> factory, string host, bool signedIn = true)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Host = host;
        if (signedIn)
        {
            var token = factory.Services.GetRequiredService<IJwtTokenService>().IssueClientToken("claude-author", ["content.draft"]).AccessToken;
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return client;
    }

    private static IServiceScope ScopeFor(WebApplicationFactory<Program> factory, string tenantDomain)
    {
        var scope = factory.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<Adventures.WebApi.RequestTenant>().Set(
            new CurrentTenant(tenantDomain.Split('.')[0] + "-id", tenantDomain, tenantDomain, tenantDomain, TenantMatch.Domain));
        return scope;
    }

    private static async Task SwitchAsync(WebApplicationFactory<Program> factory, string tenantDomain, bool on)
    {
        using var scope = ScopeFor(factory, tenantDomain);
        await scope.ServiceProvider.GetRequiredService<IPlugins>().SetEnabledAsync("sample-web", on);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static async Task<int> HeardAsync(WebApplicationFactory<Program> factory) =>
        (await ReadAsync(await As(factory, "acme.test").GetAsync("/api/plugins/sample-web/hello"))).GetProperty("exceptionsHeard").GetInt32();

    [Fact]
    public async Task AnApprovedDll_Brings_ItsApi_ItsTool_AndItsSetting_IntoTheRealHost()
    {
        PlaceSample(approved: true);
        using var factory = Host();

        var hello = await As(factory, "acme.test").GetAsync("/api/plugins/sample-web/hello");
        var anonymous = await As(factory, "acme.test", signedIn: false).GetAsync("/api/plugins/sample-web/hello");
        var tools = await ReadAsync(await As(factory, "acme.test").GetAsync("/api/tools"));

        Assert.Equal(HttpStatusCode.OK, hello.StatusCode);
        Assert.Equal("hello from the sample web plug-in", (await ReadAsync(hello)).GetProperty("greeting").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Contains(tools.EnumerateArray(), t => t.GetProperty("name").GetString() == "sample_hello" && t.GetProperty("path").GetString() == "api/plugins/sample-web/hello");
    }

    [Fact]
    public async Task SwitchingThePluginOff_ForOneTenant_RemovesItsApiAndTool_OnlyThere()
    {
        PlaceSample(approved: true);
        using var factory = Host();
        await SwitchAsync(factory, "acme.test", on: false);

        var offApi = await As(factory, "acme.test").GetAsync("/api/plugins/sample-web/hello");
        var offTools = await ReadAsync(await As(factory, "acme.test").GetAsync("/api/tools"));
        var otherApi = await As(factory, "other.test").GetAsync("/api/plugins/sample-web/hello");

        Assert.Equal(HttpStatusCode.NotFound, offApi.StatusCode);
        Assert.DoesNotContain(offTools.EnumerateArray(), t => t.GetProperty("name").GetString() == "sample_hello");
        Assert.Equal(HttpStatusCode.OK, otherApi.StatusCode);
    }

    [Fact]
    public async Task ARecordedException_IsHeardByThePluginsHandler_OnlyWhileItIsOn()
    {
        PlaceSample(approved: true);
        using var factory = Host();
        using (var scope = ScopeFor(factory, "acme.test"))
        {
            await scope.ServiceProvider.GetRequiredService<IExceptionLogBll>().RecordAsync(new InvalidOperationException("heard by the sample"), "GET /x", null);
        }

        var heard = 0;
        for (var i = 0; i < 100 && heard == 0; i++)
        {
            await Task.Delay(100);
            heard = await HeardAsync(factory);
        }

        Assert.Equal(1, heard);

        await SwitchAsync(factory, "acme.test", on: false);
        using (var scope = ScopeFor(factory, "acme.test"))
        {
            await scope.ServiceProvider.GetRequiredService<IExceptionLogBll>().RecordAsync(new InvalidOperationException("not heard while off"), "GET /y", null);
        }

        await Task.Delay(500);
        await SwitchAsync(factory, "acme.test", on: true);
        Assert.Equal(1, await HeardAsync(factory));
    }

    [Fact]
    public async Task ADllThatIsNotOnTheApprovedList_Brings_Nothing_AndIsReported()
    {
        PlaceSample(approved: false);
        using var factory = Host();

        var hello = await As(factory, "acme.test").GetAsync("/api/plugins/sample-web/hello");
        var report = factory.Services.GetRequiredService<PluginLoadReport>();

        Assert.Equal(HttpStatusCode.NotFound, hello.StatusCode);
        Assert.Empty(report.Loaded);
        Assert.Contains(report.Failures, f => f.Source == "directory:" + Dll && f.Reason.Contains("approved list"));
    }

    [Fact]
    public async Task APluginsWidget_CanBePlacedInAZone_AndShowsOnThePublicPage_OnlyForTheTenantAndWhileItIsOn()
    {
        PlaceSample(approved: true);
        using var factory = Host();
        using (var scope = ScopeFor(factory, "acme.test"))
        {
            var placed = await scope.ServiceProvider.GetRequiredService<Adventures.Blog.IWidgetPlacements>()
                .AddAsync("left", "sample-web.note", "Notes", new Dictionary<string, string> { ["Text"] = "hello <b>zone</b>" });
            Assert.Equal("left", placed.Zone);
        }

        var shown = await ReadAsync(await As(factory, "acme.test", signedIn: false).GetAsync("/api/public/widgets/left"));
        var other = await ReadAsync(await As(factory, "other.test", signedIn: false).GetAsync("/api/public/widgets/left"));
        var wrongZone = await As(factory, "acme.test", signedIn: false).GetAsync("/api/public/widgets/sidebar");

        var widget = Assert.Single(shown.EnumerateArray());
        Assert.Equal("Notes", widget.GetProperty("title").GetString());
        Assert.Contains("hello &lt;b&gt;zone&lt;/b&gt;", widget.GetProperty("html").GetString());
        Assert.Equal(0, other.GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, wrongZone.StatusCode);

        await SwitchAsync(factory, "acme.test", on: false);
        var off = await ReadAsync(await As(factory, "acme.test", signedIn: false).GetAsync("/api/public/widgets/left"));
        Assert.Equal(0, off.GetArrayLength());
    }
}
