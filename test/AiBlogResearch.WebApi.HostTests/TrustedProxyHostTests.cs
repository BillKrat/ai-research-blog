using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// Running behind a proxy, through the real pipeline: the sign-in limit is per visitor address. Behind a listed proxy two visitors get their own window; a forwarded address from a caller that is
/// NOT a listed proxy is ignored, so nobody can use a header to get a fresh window (or to share another's). An empty request body is enough here: the limiter runs before the action and counts it.
/// </summary>
public sealed class TrustedProxyHostTests
{
    private const string Proxy = "10.20.30.40";
    private const string Stranger = "198.51.100.9";

    private sealed class CallerAddress(string address) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, forward) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Parse(address);
                return forward(context);
            });
            next(app);
        };
    }

    private static WebApplicationFactory<Program> Host(string caller, string? trusted) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            // Legacy mode with an unused string, like the other host tests: native mode wants the Postgres identity connection, which only a developer machine has (user-secrets), so CI answered 500
            builder.UseSetting("Data:Mode", "Legacy");
            builder.UseSetting("ConnectionStrings:LegacySql", "Server=unused;Database=unused;User Id=u;Password=p;TrustServerCertificate=true");
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.UseSetting("Tenancy:CacheSeconds", "0");
            builder.UseSetting("RateLimit:TokensPerMinute", "2");
            if (trusted is not null)
            {
                builder.UseSetting("Proxy:Trusted", trusted);
            }

            builder.ConfigureTestServices(services => services.AddSingleton<IStartupFilter>(new CallerAddress(caller)));
        });

    private static async Task<HttpStatusCode> SignInAsync(HttpClient client, string? visitor)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/token") { Content = JsonContent.Create(new { }) };
        if (visitor is not null)
        {
            request.Headers.Add("X-Forwarded-For", visitor);
            request.Headers.Add("X-Forwarded-Proto", "https");
        }

        return (await client.SendAsync(request)).StatusCode;
    }

    [Fact]
    public async Task BehindAListedProxy_EachVisitorHasTheirOwnWindow()
    {
        using var factory = Host(caller: Proxy, trusted: Proxy);
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, await SignInAsync(client, "203.0.113.7"));
        Assert.Equal(HttpStatusCode.BadRequest, await SignInAsync(client, "203.0.113.7"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await SignInAsync(client, "203.0.113.7"));

        Assert.Equal(HttpStatusCode.BadRequest, await SignInAsync(client, "203.0.113.8"));
    }

    [Fact]
    public async Task AForwardedAddressFromACallerThatIsNotAListedProxyIsIgnored()
    {
        using var factory = Host(caller: Stranger, trusted: Proxy);
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, await SignInAsync(client, "203.0.113.7"));
        Assert.Equal(HttpStatusCode.BadRequest, await SignInAsync(client, "203.0.113.8"));

        // a fresh address in the header buys no fresh window: the caller is still the stranger
        Assert.Equal(HttpStatusCode.TooManyRequests, await SignInAsync(client, "203.0.113.9"));
    }

    [Fact]
    public async Task WithNoProxyListedNoForwardedAddressIsBelievedFromAnyone()
    {
        using var factory = Host(caller: Proxy, trusted: null);
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, await SignInAsync(client, "203.0.113.7"));
        Assert.Equal(HttpStatusCode.BadRequest, await SignInAsync(client, "203.0.113.8"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await SignInAsync(client, "203.0.113.9"));
    }

    [Fact]
    public async Task ABadProxySettingStopsTheHostFromStarting_NamingTheSetting()
    {
        using var factory = Host(caller: Proxy, trusted: "not-an-address");

        var failure = await Assert.ThrowsAnyAsync<Exception>(async () => await SignInAsync(factory.CreateClient(), null));

        Assert.Contains("Proxy:Trusted", failure.ToString());
    }
}
