using Adventures.Entities;
using Adventures.MEF;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.HostTests;

/// <summary>
/// The real host wires the event bus end to end: a plug-in handler registered for a plug-in that is on is called, off the request, when an exception is
/// recorded (the exception log raises the event, the hosted dispatcher delivers it, the tenant context is restored).
/// </summary>
public sealed class PluginEventsHostTests : IClassFixture<WebApplicationFactory<Program>>
{
    private sealed class Sink
    {
        public TaskCompletionSource<ExceptionRecordedEvent> Received { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    }

    private sealed class SinkHandler(Sink sink) : IPluginEventHandler<ExceptionRecordedEvent>
    {
        public Task HandleAsync(ExceptionRecordedEvent pluginEvent, CancellationToken cancellationToken)
        {
            sink.Received.TrySetResult(pluginEvent);
            return Task.CompletedTask;
        }
    }

    private readonly Sink _sink = new();
    private readonly WebApplicationFactory<Program> _factory;

    public PluginEventsHostTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Data:Mode", "Legacy");
            builder.UseSetting("ConnectionStrings:LegacySql", "Server=unused;Database=unused;User Id=u;Password=p;TrustServerCertificate=true");
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.UseSetting("Jwt:SigningKey", "0123456789abcdef0123456789abcdef0123456789abcdef");
            builder.UseSetting("NQuadStore:Provider", "Memory");
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(_sink);
                // "html-sanitizer" is a plug-in that is on by default, standing in for a developer's own plug-in
                services.AddPluginEventHandler<ExceptionRecordedEvent, SinkHandler>("html-sanitizer");
            });
        });
    }

    [Fact]
    public async Task ARecordedException_ReachesAPluginHandler_ThroughTheRealHost()
    {
        using var scope = _factory.Services.CreateScope();

        var entryId = await scope.ServiceProvider.GetRequiredService<IExceptionLogBll>().RecordAsync(new InvalidOperationException("host event test"), "GET /x", null, "corr-host");

        var received = await _sink.Received.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(entryId, received.EntryId);
        Assert.Equal("host event test", received.Message);
        Assert.Equal("corr-host", received.CorrelationId);
    }
}
