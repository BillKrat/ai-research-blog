using Adventures.Entities;
using Adventures.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

public sealed record ExceptionCount(int Count);

public sealed record PurgeResult(int Purged);

/// <summary>
/// The administrator's view of the exception log (see <see cref="UnhandledExceptionHandler"/>): the active count that
/// drives the warning icon, the grid, and purge. Purge soft-deletes every entry, like any other delete, so the history
/// stays in the store. Administrators only; this area later moves onto the Dashboard.
/// </summary>
[ApiController]
[Route("api/admin/exceptions")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class AdminExceptionsController(IExceptionLogPresenter presenter) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<EntityGridModel>> Grid(CancellationToken cancellationToken) =>
        Ok(await presenter.GetGridAsync(cancellationToken));

    [HttpGet("count")]
    public async Task<ActionResult<ExceptionCount>> Count(CancellationToken cancellationToken) =>
        Ok(new ExceptionCount(await presenter.CountActiveAsync(cancellationToken)));

    [HttpDelete]
    public async Task<ActionResult<PurgeResult>> Purge(CancellationToken cancellationToken) =>
        Ok(new PurgeResult(await presenter.PurgeAsync(cancellationToken)));
}
