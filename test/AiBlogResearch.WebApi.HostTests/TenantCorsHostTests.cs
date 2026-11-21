using System.Net;
using Adventures.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// T4a through the real pipeline: a browser preflight is answered for a site an administrator registered (a domain, its www host or an alias such as the
/// host's temporary address) and for nothing else. The temporary address in the bug report (http, no certificate yet) works once it is an alias.
/// </summary>
public sealed class TenantCorsHostTests
{
    private sealed class Hosts(params string[] names) : ITenantHostSource
    {
        public Task<IReadOnlyList<string>> AllNamesAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<string>>(names);
    }

    private static WebApplicationFactory<Program> Host() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            builder.ConfigureTestServices(services => services.AddScoped<ITenantHostSource>(_ => new Hosts("example.com", "billkrat-001-site1.atempurl.com")));
        });

    private static async Task<HttpResponseMessage> PreflightAsync(WebApplicationFactory<Program> factory, string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/token");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type,authorization");
        return await factory.CreateClient().SendAsync(request);
    }

    [Theory]
    [InlineData("https://example.com")]
    [InlineData("https://www.example.com")]
    [InlineData("http://billkrat-001-site1.atempurl.com")]
    public async Task ARegisteredSite_GetsItsOriginEchoed(string origin)
    {
        using var factory = Host();

        var response = await PreflightAsync(factory, origin);

        Assert.True(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var allowed));
        Assert.Equal(origin, Assert.Single(allowed));
        Assert.False(response.Headers.Contains("Access-Control-Allow-Credentials"));
    }

    [Theory]
    [InlineData("https://evil.test")]
    [InlineData("http://example.com")]
    [InlineData("https://example.com.evil.test")]
    public async Task AnythingElse_GetsNoAllowOriginHeader(string origin)
    {
        using var factory = Host();

        var response = await PreflightAsync(factory, origin);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);
    }
}
