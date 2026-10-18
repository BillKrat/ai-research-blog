using System.Net;
using System.Net.Http.Json;
using Adventures.Security;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public class HealthControllerTests
{
    private static IJwtTokenService BuildTokenService() =>
        new JwtTokenService(Options.Create(new JwtTokenOptions
        {
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            SigningKey = "0123456789abcdef0123456789abcdef",
            AccessTokenLifetime = TimeSpan.FromMinutes(30),
        }));

    /// <summary>Hand-rolled test double, not a mocking library - matches this repo's established convention.</summary>
    private sealed class FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(respond(request));
        }
    }

    private sealed class FakeHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            new(handler, disposeHandler: false) { BaseAddress = new Uri("https://mcp.example.test/") };
    }

    private static HealthController BuildController(FakeHttpMessageHandler handler) =>
        new(BuildTokenService(), new FakeHttpClientFactory(handler), NullLogger<HealthController>.Instance);

    [Fact]
    public async Task Get_IncludesMcpMessage_WhenMcpServerRespondsSuccessfully()
    {
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new { message = "hello world" }),
        });
        var controller = BuildController(handler);

        var result = await controller.Get(CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<HealthResponse>(okResult.Value);
        Assert.Equal("Healthy", response.Status);
        Assert.Equal("hello world", response.McpMessage);
        Assert.Equal("ok", response.McpStatus);

        Assert.NotNull(handler.LastRequest);
        Assert.Equal("Bearer", handler.LastRequest!.Headers.Authorization?.Scheme);
        Assert.False(string.IsNullOrWhiteSpace(handler.LastRequest.Headers.Authorization?.Parameter));
        Assert.Equal("api/hello", handler.LastRequest.RequestUri?.AbsolutePath.TrimStart('/'));
    }

    [Fact]
    public async Task Get_ReturnsHealthyWithNullMcpMessage_WhenMcpServerIsUnreachable()
    {
        var handler = new FakeHttpMessageHandler(_ => throw new HttpRequestException("simulated network failure"));
        var controller = BuildController(handler);

        var result = await controller.Get(CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<HealthResponse>(okResult.Value);
        Assert.Equal("Healthy", response.Status);
        Assert.Null(response.McpMessage);
        Assert.StartsWith("exception_", response.McpStatus);
    }

    [Fact]
    public async Task Get_ReturnsHealthyWithNullMcpMessage_WhenMcpServerReturnsErrorStatus()
    {
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var controller = BuildController(handler);

        var result = await controller.Get(CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<HealthResponse>(okResult.Value);
        Assert.Null(response.McpMessage);
        Assert.Equal("http_401", response.McpStatus);
    }

    [Fact]
    public async Task Get_RecordsAnUnreachableMcpInTheExceptionLog_ThrottledToOncePerHour()
    {
        var log = new UnhandledExceptionHandlerTests.RecordingExceptionLog("id-1");
        var handler = new FakeHttpMessageHandler(_ => throw new HttpRequestException("simulated network failure"));
        var controller = new HealthController(BuildTokenService(), new FakeHttpClientFactory(handler), NullLogger<HealthController>.Instance, log);

        await controller.Get(CancellationToken.None);

        var recorded = Assert.Single(log.Throttled);
        Assert.Equal("health probe: mcp", recorded.Request);
        Assert.Equal(TimeSpan.FromHours(1), recorded.Window);
    }

    [Fact]
    public async Task Get_RecordsAnMcpErrorStatus_ButNotASuccess()
    {
        var log = new UnhandledExceptionHandlerTests.RecordingExceptionLog("id-1");
        var failing = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        await new HealthController(BuildTokenService(), new FakeHttpClientFactory(failing), NullLogger<HealthController>.Instance, log)
            .Get(CancellationToken.None);
        Assert.Single(log.Throttled);

        var healthy = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { message = "hi" }) });
        await new HealthController(BuildTokenService(), new FakeHttpClientFactory(healthy), NullLogger<HealthController>.Instance, log)
            .Get(CancellationToken.None);
        Assert.Single(log.Throttled);
    }
}
