// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - security findings F-1 to F-3 fixed in this file or in code it uses, covered by tests. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Common.Diagnostics;
using Adventures.Entities;
using Adventures.WebApi;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

[Microsoft.AspNetCore.Authorization.AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class HealthController(
    IDependencyProbes probes,
    IExceptionLogBll? exceptionLog = null,
    Microsoft.Extensions.Options.IOptions<AnthropicOptions>? anthropic = null,
    TimeProvider? clock = null,
    IConfiguration? configuration = null) : ControllerBase
{
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
            HttpContext is null ? null : CorrelationIdMiddleware.Get(HttpContext), ProbeFailureWindow, cancellationToken);
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
            HttpContext is null ? null : CorrelationIdMiddleware.Get(HttpContext),
            configuration?["LiveData:Active"] == "true");

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
                HttpContext is null ? null : CorrelationIdMiddleware.Get(HttpContext), TimeSpan.FromHours(24), CancellationToken.None);
        }

        return new DependencyHealth("ai-key", "failed", 0, detail);
    }

    /// <summary>The database check (shared with the triage through <see cref="DependencyProbes"/>); a failure reaches the exception log. Null when no store is registered.</summary>
    private async Task<DependencyHealth?> CheckDatabaseAsync(CancellationToken cancellationToken)
    {
        var probe = await probes.ProbeDatabaseAsync(cancellationToken);
        if (probe.Skipped)
        {
            return null;
        }

        if (!probe.Ok && exceptionLog is not null && probe.Failure is not null)
        {
            await exceptionLog.RecordThrottledAsync(
                probe.Failure, "health probe: database", null,
                HttpContext is null ? null : CorrelationIdMiddleware.Get(HttpContext), ProbeFailureWindow, CancellationToken.None);
        }

        return new DependencyHealth("database", probe.Ok ? "ok" : "failed", probe.DurationMs, probe.Detail);
    }

    /// <summary>
    /// Calls mcp's M2M-protected /api/hello over a token this app mints for itself (the same JWT issuer mcp validates against,
    /// via the shared Adventures.Security signing key - see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md). Fails soft:
    /// a down or misconfigured mcp site degrades this one field instead of making /api/health unavailable, since this is a
    /// downstream dependency check, not the health of this app. The status is deliberately non-sensitive (a short reason
    /// code, never a token, secret or exception message).
    /// </summary>
    private async Task<(string? Message, string Status)> TryGetMcpHelloMessageAsync(CancellationToken cancellationToken)
    {
        var probe = await probes.ProbeMcpAsync(cancellationToken);
        if (!probe.Ok && probe.Failure is not null)
        {
            await RecordProbeFailureAsync(probe.Failure, CancellationToken.None);
        }

        return (probe.Message, probe.Detail);
    }
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
    string? CorrelationId = null,
    bool LiveData = false);
