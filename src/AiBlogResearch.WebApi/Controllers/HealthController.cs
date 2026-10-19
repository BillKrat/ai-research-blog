using System.Net.Http.Headers;
using System.Net.Http.Json;
using Adventures.Entities;
using Adventures.Security;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController(
    IJwtTokenService tokenService,
    IHttpClientFactory httpClientFactory,
    ILogger<HealthController> logger,
    IExceptionLogBll? exceptionLog = null,
    Adventures.Data.NQuad.INQuadStore? store = null,
    Microsoft.Extensions.Options.IOptions<AnthropicOptions>? anthropic = null,
    TimeProvider? clock = null) : ControllerBase
{
    /// <summary>How long the database check may take before it counts as failed.</summary>
    internal static readonly TimeSpan DatabaseCheckTimeout = TimeSpan.FromSeconds(5);

    /// <summary>A failing dependency reaches the exception log (and the admin icon) at most once per signature per hour.</summary>
    internal static readonly TimeSpan ProbeFailureWindow = TimeSpan.FromHours(1);

    private async Task RecordProbeFailureAsync(Exception failure, CancellationToken cancellationToken)
    {
        if (exceptionLog is null)
        {
            return;
        }

        await exceptionLog.RecordThrottledAsync(
            failure, "health probe: mcp", null,
            HttpContext is null ? null : Adventures.WebApi.CorrelationIdMiddleware.Get(HttpContext), ProbeFailureWindow, cancellationToken);
    }

    [HttpGet]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken cancellationToken)
    {
        var dependencies = new List<DependencyHealth>();

        var watch = System.Diagnostics.Stopwatch.StartNew();
        var (mcpMessage, mcpStatus) = await TryGetMcpHelloMessageAsync(cancellationToken);
        dependencies.Add(new DependencyHealth("mcp", mcpStatus == "ok" ? "ok" : "failed", watch.ElapsedMilliseconds, mcpStatus));

        var database = await CheckDatabaseAsync(cancellationToken);
        if (database is not null)
        {
            dependencies.Add(database);
        }

        var aiKey = await CheckAiKeyAsync();
        if (aiKey is not null)
        {
            dependencies.Add(aiKey);
        }

        // The API's own state: a failed database makes it Unhealthy (503, so a deploy smoke test fails), a failed mcp only
        // Degraded (200, because the API still serves its own work). The detail is a short code, never an exception message.
        var status = dependencies.Any(d => d.Name == "database" && d.Status != "ok") ? "Unhealthy"
            : dependencies.Any(d => d.Status != "ok") ? "Degraded"
            : "Healthy";
        var response = new HealthResponse(
            status, DateTimeOffset.UtcNow, mcpMessage, mcpStatus, dependencies,
            HttpContext is null ? null : Adventures.WebApi.CorrelationIdMiddleware.Get(HttpContext));

        return status == "Unhealthy" ? StatusCode(StatusCodes.Status503ServiceUnavailable, response) : Ok(response);
    }

    /// <summary>How many days before the AI key expires the health check starts to warn.</summary>
    internal const int AiKeyWarningDays = 14;

    /// <summary>
    /// The AI key is a secret that expires (the date is Anthropic:KeyExpiresOn): from 14 days before, and after, the health
    /// shows it as failed ("expires_in_9_days" / "expired") and the exception log gets one entry a day, so an expiring key
    /// is seen before the button stops working. Null when no key (or no date) is configured.
    /// </summary>
    private async Task<DependencyHealth?> CheckAiKeyAsync()
    {
        var settings = anthropic?.Value;
        if (settings is null || string.IsNullOrWhiteSpace(settings.ApiKey) || settings.KeyExpiresOn is not { } expires)
        {
            return null;
        }

        var today = DateOnly.FromDateTime((clock ?? TimeProvider.System).GetUtcNow().UtcDateTime);
        var days = expires.DayNumber - today.DayNumber;
        if (days > AiKeyWarningDays)
        {
            return new DependencyHealth("ai-key", "ok", 0, "ok");
        }

        var detail = days < 0 ? "expired" : $"expires_in_{days}_days";
        if (exceptionLog is not null)
        {
            await exceptionLog.RecordThrottledAsync(
                new InvalidOperationException($"The Anthropic API key {(days < 0 ? "has expired" : $"expires in {days} day(s)")} ({expires:yyyy-MM-dd}); rotate it."),
                "health probe: ai key", null,
                HttpContext is null ? null : Adventures.WebApi.CorrelationIdMiddleware.Get(HttpContext), TimeSpan.FromHours(24), CancellationToken.None);
        }

        return new DependencyHealth("ai-key", "failed", 0, detail);
    }

    /// <summary>Asks the N-Quad store (the database) for a count, which proves connection, credentials and the table. Null when no store is registered.</summary>
    private async Task<DependencyHealth?> CheckDatabaseAsync(CancellationToken cancellationToken)
    {
        if (store is null)
        {
            return null;
        }

        var watch = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(DatabaseCheckTimeout);
            await store.CountAsync(timeout.Token);
            return new DependencyHealth("database", "ok", watch.ElapsedMilliseconds, "ok");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "The health check could not reach the database.");
            if (exceptionLog is not null)
            {
                await exceptionLog.RecordThrottledAsync(
                    ex, "health probe: database", null,
                    HttpContext is null ? null : Adventures.WebApi.CorrelationIdMiddleware.Get(HttpContext), ProbeFailureWindow, CancellationToken.None);
            }

            return new DependencyHealth("database", "failed", watch.ElapsedMilliseconds, ex is OperationCanceledException ? "timeout" : $"exception_{ex.GetType().Name}");
        }
    }

    /// <summary>
    /// Calls mcp.global-webnet.com's M2M-protected /api/hello over a token this app mints for itself
    /// (it's the same JWT issuer mcp validates against, via the shared Adventures.Security signing
    /// key - see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md for the full pipeline). Fails soft:
    /// a down/misconfigured mcp site degrades this one field instead of making /api/health itself
    /// unavailable, since this is a downstream dependency check, not the health of this app itself.
    /// McpStatus is deliberately non-sensitive (a short reason code, never a token/secret/exception
    /// message) - added after this pipeline's first real deploy silently returned a null message
    /// with nothing to diagnose it by (see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md).
    /// </summary>
    private async Task<(string? Message, string Status)> TryGetMcpHelloMessageAsync(CancellationToken cancellationToken)
    {
        try
        {
            var token = tokenService.IssueClientToken("mcp-host", ["mcp.hello"]).AccessToken;

            using var client = httpClientFactory.CreateClient("McpServer");
            using var request = new HttpRequestMessage(HttpMethod.Get, "api/hello");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning(
                    "mcp.global-webnet.com/api/hello returned {StatusCode} {ReasonPhrase}. Body: {Body}",
                    (int)response.StatusCode,
                    response.ReasonPhrase,
                    body);
                await RecordProbeFailureAsync(
                    new HttpRequestException($"mcp /api/hello returned {(int)response.StatusCode} {response.ReasonPhrase}"), cancellationToken);
                return (null, $"http_{(int)response.StatusCode}");
            }

            var parsed = await response.Content.ReadFromJsonAsync<McpHelloResponse>(cancellationToken);
            return (parsed?.Message, "ok");
        }
        catch (Exception ex)
        {
            // Broad catch deliberately: this is a downstream health probe, not core request
            // handling - no exception type here should ever turn /api/health itself into a 500.
            logger.LogWarning(ex, "Failed to reach mcp.global-webnet.com for the health check's mcp message.");
            await RecordProbeFailureAsync(ex, CancellationToken.None);
            return (null, ex is OperationCanceledException ? "timeout" : $"exception_{ex.GetType().Name}");
        }
    }

    private sealed record McpHelloResponse(string Message);
}

/// <summary>One thing the API depends on: ok or failed, how long the check took, and a short non-sensitive code.</summary>
public sealed record DependencyHealth(string Name, string Status, long DurationMs, string? Detail);

/// <summary>Healthy, Degraded (a dependency other than the database failed) or Unhealthy (the database failed; HTTP 503).</summary>
public record HealthResponse(
    string Status,
    DateTimeOffset TimestampUtc,
    string? McpMessage = null,
    string? McpStatus = null,
    IReadOnlyList<DependencyHealth>? Dependencies = null,
    string? CorrelationId = null);
