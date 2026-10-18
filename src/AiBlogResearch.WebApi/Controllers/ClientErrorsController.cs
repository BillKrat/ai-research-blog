using Adventures.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

public sealed record ClientErrorReport(string? Message, string? Stack, string? Url);

/// <summary>
/// Where the browser reports an error it caught (no silent errors: a failure that never reached the server would
/// otherwise live only in one person's console). Signed-in users only, so the store cannot be filled anonymously;
/// each kind of error is recorded at most once per ten minutes and the whole endpoint is capped per minute.
/// </summary>
[ApiController]
[Route("api/client-errors")]
[Authorize]
public sealed class ClientErrorsController(IExceptionLogBll exceptionLog, ILogger<ClientErrorsController> logger) : ControllerBase
{
    public static readonly TimeSpan SameErrorWindow = TimeSpan.FromMinutes(10);
    private const int MaxPerMinute = 30;
    private const int MaxText = 2_000;
    private static readonly object Gate = new();
    private static DateTimeOffset _minuteStart = DateTimeOffset.MinValue;
    private static int _inMinute;

    [HttpPost]
    public async Task<IActionResult> Report([FromBody] ClientErrorReport report, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(report.Message))
        {
            return BadRequest("A message is required.");
        }

        if (!TryCount())
        {
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }

        var correlationId = Adventures.WebApi.CorrelationIdMiddleware.Get(HttpContext);
        var url = Limit(report.Url) ?? "(unknown page)";
        var exception = new ClientReportedException(Limit(report.Message)!, Limit(report.Stack));
        logger.LogWarning("Client error on {Url}: {Message}", url, exception.Message);

        var id = await exceptionLog.RecordThrottledAsync(
            exception, $"client: {url}", User.Identity?.Name, correlationId, SameErrorWindow, cancellationToken);
        return Accepted(new { errorId = id, correlationId });
    }

    private static string? Limit(string? text) => text is { Length: > MaxText } ? text[..MaxText] : text;

    private static bool TryCount()
    {
        lock (Gate)
        {
            var now = DateTimeOffset.UtcNow;
            if (now - _minuteStart >= TimeSpan.FromMinutes(1))
            {
                _minuteStart = now;
                _inMinute = 0;
            }

            return ++_inMinute <= MaxPerMinute;
        }
    }
}
