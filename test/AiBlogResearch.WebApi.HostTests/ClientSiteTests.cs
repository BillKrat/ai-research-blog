using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// Single-site mode (onboarding decision, 2026-11-22): when the client build is in the API's web root, the one host serves the app, so a temporary address is the whole install.
/// The client has a Content-Security-Policy of its own (the API default is "default-src 'none'" and would blank the page), built from the page itself so the one inline script the
/// build emits is allowed by its hash and nothing else inline is. Client routes fall back to the page; the API never does.
/// </summary>
public sealed class ClientSiteTests : IDisposable
{
    private const string InlineScript = "document.querySelectorAll('link[data-x]').forEach(function(l){l.media='all'});";

    private readonly string _webRoot = Path.Combine(Path.GetTempPath(), "client-site-" + Guid.NewGuid().ToString("N"));

    private static string Sha256Of(string text) => "'sha256-" + Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(text))) + "'";

    private HttpClient Client(bool withClient = true, string? serveClient = null)
    {
        if (withClient)
        {
            Directory.CreateDirectory(_webRoot);
            File.WriteAllText(Path.Combine(_webRoot, "index.html"), $"<!doctype html><html><head><base href=\"/\"></head><body><app-root></app-root><script src=\"main-ABC123.js\" type=\"module\"></script><script>{InlineScript}</script></body></html>");
            File.WriteAllText(Path.Combine(_webRoot, "main-ABC123.js"), "console.log(1)");
            File.WriteAllText(Path.Combine(_webRoot, "favicon.ico"), "icon");
        }

        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Data:Mode", "Legacy");
            builder.UseSetting("ConnectionStrings:LegacySql", "Server=unused;Database=unused;User Id=u;Password=p;TrustServerCertificate=true");
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            if (serveClient is not null)
            {
                builder.UseSetting("Hosting:ServeClient", serveClient);
            }

            if (withClient)
            {
                builder.UseSetting("webroot", _webRoot);
            }
        });
        return factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("http://localhost") });
    }

    public void Dispose()
    {
        if (Directory.Exists(_webRoot))
        {
            Directory.Delete(_webRoot, recursive: true);
        }
    }

    [Fact]
    public async Task TheRoot_IsTheClientPage_NotTheServiceBanner_AndIsNeverCached()
    {
        var response = await Client().GetAsync("/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("<app-root>", await response.Content.ReadAsStringAsync());
        Assert.Contains("no-cache", response.Headers.CacheControl!.ToString());
    }

    [Fact]
    public async Task ThePageCarriesAPolicyThatAllowsItself_ItsOneInlineScriptByHash_AndNothingElseInline()
    {
        var response = await Client().GetAsync("/");

        var policy = Assert.Single(response.Headers.GetValues("Content-Security-Policy"));
        Assert.DoesNotContain("default-src 'none'", policy);
        Assert.Contains("default-src 'self'", policy);
        Assert.Contains("script-src 'self' " + Sha256Of(InlineScript), policy);
        Assert.DoesNotContain("script-src 'self' 'unsafe-inline'", policy);
        Assert.DoesNotContain("'unsafe-eval'", policy);
        Assert.Contains("frame-ancestors 'none'", policy);
        Assert.Contains("object-src 'none'", policy);
        Assert.Contains("connect-src 'self'", policy);
        Assert.Contains("DENY", Assert.Single(response.Headers.GetValues("X-Frame-Options")));
    }

    [Fact]
    public async Task AHashedAsset_IsServedAndCachedForAYear_AnUnhashedFileIsNot()
    {
        var client = Client();

        var asset = await client.GetAsync("/main-ABC123.js");
        var icon = await client.GetAsync("/favicon.ico");

        Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
        Assert.Contains("immutable", asset.Headers.CacheControl!.ToString());
        Assert.Contains("max-age=31536000", asset.Headers.CacheControl!.ToString());
        Assert.Equal(HttpStatusCode.OK, icon.StatusCode);
        Assert.DoesNotContain("immutable", icon.Headers.CacheControl?.ToString() ?? string.Empty);
    }

    [Theory]
    [InlineData("/login")]
    [InlineData("/admin/posts")]
    [InlineData("/post/hello-world")]
    [InlineData("/category/Help")]
    public async Task AClientRoute_FallsBackToThePage(string path)
    {
        var response = await Client().GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("<app-root>", await response.Content.ReadAsStringAsync());
        Assert.Contains("default-src 'self'", Assert.Single(response.Headers.GetValues("Content-Security-Policy")));
    }

    [Theory]
    [InlineData("/api/does-not-exist")]
    [InlineData("/api/")]
    [InlineData("/api/public/nothing/here")]
    public async Task TheApiNeverFallsBackToThePage_AnUnknownApiRouteIsA404(string path)
    {
        var response = await Client().GetAsync(path);

        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("<app-root>", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("/missing.js")]
    [InlineData("/assets/missing.png")]
    [InlineData("/chunk-NOPE.js")]
    public async Task AMissingFile_IsA404_NeverThePage(string path)
    {
        var response = await Client().GetAsync(path);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain("<app-root>", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task OnlyReadsFallBack_APostToAClientRouteIsNotThePage()
    {
        var response = await Client().PostAsync("/login", new StringContent("x"));

        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task APathThatTriesToLeaveTheWebRoot_ServesNothing()
    {
        var response = await Client().GetAsync("/..%2f..%2fappsettings.json");

        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task TheApiItself_KeepsItsStrictPolicy()
    {
        var response = await Client().GetAsync("/api/health");

        Assert.Contains("default-src 'none'", Assert.Single(response.Headers.GetValues("Content-Security-Policy")));
    }

    [Fact]
    public async Task WithNoClientBuild_TheHostIsTheApiAlone_AsBefore()
    {
        var root = await Client(withClient: false).GetAsync("/");
        var route = await Client(withClient: false).GetAsync("/login");

        Assert.Equal(HttpStatusCode.OK, root.StatusCode);
        Assert.Contains("AiBlogResearch.WebApi", await root.Content.ReadAsStringAsync());
        Assert.NotEqual(HttpStatusCode.OK, route.StatusCode);
    }

    [Fact]
    public async Task TheSettingCanSwitchItOff_EvenWithABuildInPlace()
    {
        var root = await Client(serveClient: "false").GetAsync("/");

        Assert.Contains("AiBlogResearch.WebApi", await root.Content.ReadAsStringAsync());
    }
}
