using Adventures.Common.Diagnostics;
using Adventures.Entities;
using Adventures.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>Active exceptions (what the warning icon counts) and all of them, purged ones included (the history worth opening).</summary>
public sealed record ExceptionCount(int Count, int Total);

public sealed record PurgeResult(int Purged);

public sealed record SignatureStatusChange(string? Status);

/// <summary>
/// The administrator's view of the exception log (see <see cref="UnhandledExceptionHandler"/>): the active count that
/// drives the warning icon, the grid, and purge. Purge soft-deletes every entry, like any other delete, so the history
/// stays in the store. Administrators only; this area later moves onto the Dashboard.
/// </summary>
[ApiController]
[Route("api/admin/exceptions")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class AdminExceptionsController(IExceptionLogPresenter presenter, IExceptionSignatureBll signatures) : ControllerBase
{
    /// <summary>The kinds of failure seen (grouped repeats), most recently seen first, each with how often.</summary>
    [HttpGet("signatures")]
    public async Task<ActionResult<IReadOnlyList<ExceptionSignatureSummary>>> Signatures(CancellationToken cancellationToken) =>
        Ok(await signatures.ListSummariesAsync(cancellationToken));

/// <summary>An administrator's triage of one kind of failure: Acknowledged (being handled), Fixed, or back to New. A Fixed kind that recurs becomes Regressed by itself.</summary>    [HttpPut("signatures/{signatureId}/status")]    public async Task<IActionResult> SetStatus(string signatureId, [FromBody] SignatureStatusChange change, CancellationToken cancellationToken)    {        if (!ExceptionSignatureStatus.Settable.Contains(change.Status ?? string.Empty, StringComparer.Ordinal))        {            return BadRequest(new { title = $"Status must be one of: {string.Join(", ", ExceptionSignatureStatus.Settable)}." });        }        return await signatures.SetStatusAsync(signatureId, change.Status!, cancellationToken) ? NoContent() : NotFound();    }
    /// <summary>The active exceptions, newest first; <c>?includePurged=true</c> adds the purged ones (soft deleted, each marked in its State column).</summary>
    [HttpGet]
    public async Task<ActionResult<EntityGridModel>> Grid([FromQuery] bool includePurged = false, CancellationToken cancellationToken = default) =>
        Ok(includePurged ? await presenter.GetHistoryGridAsync(cancellationToken) : await presenter.GetGridAsync(cancellationToken));

    [HttpGet("count")]
    public async Task<ActionResult<ExceptionCount>> Count(CancellationToken cancellationToken) =>
        Ok(new ExceptionCount(await presenter.CountActiveAsync(cancellationToken), await presenter.CountTotalAsync(cancellationToken)));

    [HttpDelete]
    public async Task<ActionResult<PurgeResult>> Purge(CancellationToken cancellationToken) =>
        Ok(new PurgeResult(await presenter.PurgeAsync(cancellationToken)));
}
