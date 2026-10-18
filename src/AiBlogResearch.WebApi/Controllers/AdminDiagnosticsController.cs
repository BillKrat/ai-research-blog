using Adventures.Entities;
using Adventures.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>Everything known about one request: its recorded exceptions, their kinds of failure, and its log lines.</summary>
public sealed record RequestDiagnostics(CorrelationReport Report, IReadOnlyList<string> LogLines);

/// <summary>
/// Eyes into the running system for an administrator, and the surface an MCP diagnostics tool will wrap: given a
/// CorrelationId (shown in every error message and on every response) return what the system recorded for that request.
/// Read-only; administrators only.
/// </summary>
[ApiController]
[Route("api/admin/diagnostics")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class AdminDiagnosticsController(IDiagnosticsReader reader) : ControllerBase
{
    [HttpGet("{correlationId}")]
    public async Task<ActionResult<RequestDiagnostics>> ForRequest(string correlationId, CancellationToken cancellationToken)
    {
        if (!Adventures.WebApi.CorrelationIdMiddleware.IsWellFormed(correlationId))
        {
            return BadRequest("The correlation id may only contain letters, digits, '-' and '_' (at most 64 characters).");
        }

        var report = await reader.FindByCorrelationIdAsync(correlationId, cancellationToken);
        var lines = await LogSearch.FindLinesAsync(Path.Combine(AppContext.BaseDirectory, "logs"), correlationId, cancellationToken: cancellationToken);
        return Ok(new RequestDiagnostics(report, lines));
    }

    [HttpGet("recent")]
    public async Task<ActionResult<IReadOnlyList<ExceptionOccurrence>>> Recent([FromQuery] int max = 50, CancellationToken cancellationToken = default) =>
        Ok(await reader.ListRecentAsync(max, cancellationToken));
}
