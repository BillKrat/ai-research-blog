using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// The Roles list for administrators, on the grid contract. Read-only in this slice (the presenter offers no create, update or
/// delete); the roles themselves are the ones already in the baseline data.
/// </summary>
[ApiController]
[Route("api/roles")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class RolesController(IEntityPresenter<Role> presenter) : EntityControllerBase<Role>
{
    [HttpGet]
    public Task<ActionResult<EntityGridModel>> List([FromQuery] EntityGridQuery query, CancellationToken cancellationToken) =>
        GridAsync(presenter, query, cancellationToken);

    [HttpGet("{id}")]
    public Task<ActionResult<EntityFormModel>> Get(string id, CancellationToken cancellationToken) =>
        GetAsync(presenter, id, cancellationToken);
}
