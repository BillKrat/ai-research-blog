using System.Net;
using Adventures.Entities;
using AiBlogResearch.WebApi;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>An expired or failing AI key is never silent: plain-words reasons, the exception log, and a health warning before it expires.</summary>
public sealed class AiKeyVisibilityTests : IDisposable
{
    public AiKeyVisibilityTests() => AiTriage.ResetForTests();

    public void Dispose() => AiTriage.ResetForTests();

    [Theory]
    [InlineData(401, """{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}""", "authentication_error", "key was rejected")]
    [InlineData(403, """{"error":{"type":"permission_error","message":"nope"}}""", "permission_error", "not allowed")]
    [InlineData(429, """{"error":{"type":"rate_limit_error","message":"slow down"}}""", "rate_limit_error", "rate limit")]
    [InlineData(400, """{"error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}""", "invalid_request_error", "no credit left")]
    [InlineData(529, """{"error":{"type":"overloaded_error","message":"busy"}}""", "overloaded_error", "having trouble")]
    [InlineData(418, "not json", "unknown", "HTTP 418")]
    public void Explain_SaysWhatHappenedInPlainWords(int status, string body, string expectedKind, string expectedPhrase)
    {
        var (kind, reason) = AiTriage.Explain(status, body);

        Assert.Equal(expectedKind, kind);
        Assert.Contains(expectedPhrase, reason);
    }

    [Fact]
    public void Explain_ForARejectedKey_SaysHowToReplaceIt()
    {
        var (_, reason) = AiTriage.Explain(401, """{"error":{"type":"authentication_error","message":"invalid"}}""");

        Assert.Contains("Anthropic__ApiKey", reason);
        Assert.Contains("KeyExpiresOn", reason);
    }

    [Fact]
    public void Explain_NeverRepeatsASecretFromTheServicesMessage()
    {
        var (_, reason) = AiTriage.Explain(401, """{"error":{"type":"authentication_error","message":"invalid key sk-ant-api03-LEAKEDKEY123456 for bill@example.com"}}""");

        Assert.DoesNotContain("LEAKEDKEY", reason);
        Assert.DoesNotContain("bill@example.com", reason);
    }

    private sealed class Handler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) });
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false) { BaseAddress = new Uri("https://api.anthropic.test/") };
    }

    private sealed class FakeEnvironment : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";

        public string ApplicationName { get; set; } = "test";

        public string ContentRootPath { get; set; } = ".";

        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }

    [Fact]
    public async Task ARejectedKey_ReachesTheExceptionLog_AndTheButtonSaysWhy()
    {
        var log = new UnhandledExceptionHandlerTests.RecordingExceptionLog("e-1");
        var services = new ServiceCollection().AddSingleton<IExceptionLogBll>(log).BuildServiceProvider();
        var ai = new AiTriage(
            new Factory(new Handler(HttpStatusCode.Unauthorized, """{"error":{"type":"authentication_error","message":"invalid x-api-key"}}""")),
            Options.Create(new AnthropicOptions { ApiKey = "sk-ant-api03-TESTKEY12345678" }),
            services.GetRequiredService<IServiceScopeFactory>(),
            new FakeEnvironment(),
            NullLogger<AiTriage>.Instance);
        var report = new CorrelationReport("req-1", [], []);
        var rules = new TriageResult("req-1", "Nothing recorded", "", [], [], "cmd");

        var result = await ai.AskAsync(report, [], rules, CancellationToken.None);

        Assert.False(result.Available);
        Assert.Contains("key was rejected", result.Reason);
        var recorded = Assert.Single(log.Throttled);
        Assert.Equal("ai triage", recorded.Request);
        Assert.Equal("req-1", recorded.CorrelationId);
        Assert.Contains("401", recorded.Exception.Message);
        Assert.DoesNotContain("TESTKEY", recorded.Exception.Message);
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private static async Task<(HealthResponse Response, UnhandledExceptionHandlerTests.RecordingExceptionLog Log)> HealthOn(
        DateOnly today, DateOnly? expires, string? key = "sk-ant-api03-TESTKEY12345678")
    {
        var log = new UnhandledExceptionHandlerTests.RecordingExceptionLog("e-1");
        var controller = new HealthController(
            new Adventures.Security.JwtTokenService(Options.Create(new Adventures.Security.JwtTokenOptions
            {
                Issuer = "i",
                Audience = "a",
                SigningKey = "0123456789abcdef0123456789abcdef",
                AccessTokenLifetime = TimeSpan.FromMinutes(5),
            })),
            new HealthFactory(),
            NullLogger<HealthController>.Instance,
            log,
            null,
            Options.Create(new AnthropicOptions { ApiKey = key, KeyExpiresOn = expires }),
            new FixedClock(new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero)));

        var result = await controller.Get(CancellationToken.None);
        return (Assert.IsType<HealthResponse>(Assert.IsType<OkObjectResult>(result.Result).Value), log);
    }

    private sealed class HealthFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            new(new Handler(HttpStatusCode.OK, """{"message":"hi"}"""), disposeHandler: true) { BaseAddress = new Uri("https://mcp.test/") };
    }

    [Fact]
    public async Task Health_WarnsFromFourteenDaysBeforeTheKeyExpires()
    {
        var (response, log) = await HealthOn(new DateOnly(2026, 11, 4), new DateOnly(2026, 11, 18));

        var key = Assert.Single(response.Dependencies!, d => d.Name == "ai-key");
        Assert.Equal("failed", key.Status);
        Assert.Equal("expires_in_14_days", key.Detail);
        Assert.Equal("Degraded", response.Status);
        var recorded = Assert.Single(log.Throttled, t => t.Request == "health probe: ai key");
        Assert.Equal(TimeSpan.FromHours(24), recorded.Window);
    }

    [Fact]
    public async Task Health_SaysExpiredAfterTheDate()
    {
        var (response, _) = await HealthOn(new DateOnly(2026, 11, 20), new DateOnly(2026, 11, 18));

        Assert.Equal("expired", Assert.Single(response.Dependencies!, d => d.Name == "ai-key").Detail);
    }

    [Fact]
    public async Task Health_IsQuiet_WhileTheKeyIsFarFromExpiry_OrWhenThereIsNoKeyOrDate()
    {
        var (far, farLog) = await HealthOn(new DateOnly(2026, 10, 19), new DateOnly(2026, 11, 18));
        Assert.Equal("ok", Assert.Single(far.Dependencies!, d => d.Name == "ai-key").Status);
        Assert.Equal("Healthy", far.Status);
        Assert.DoesNotContain(farLog.Throttled, t => t.Request == "health probe: ai key");

        var (noDate, _) = await HealthOn(new DateOnly(2026, 11, 20), null);
        Assert.DoesNotContain(noDate.Dependencies!, d => d.Name == "ai-key");

        var (noKey, _) = await HealthOn(new DateOnly(2026, 11, 20), new DateOnly(2026, 11, 18), key: null);
        Assert.DoesNotContain(noKey.Dependencies!, d => d.Name == "ai-key");
    }
}
