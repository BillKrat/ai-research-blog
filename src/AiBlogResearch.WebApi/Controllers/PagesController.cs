using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// Pages for administrators, on the form and grid contracts: the list (sorted, paged, with parent shown by title), the empty
/// form, one page with lookup links, create, update and delete. The page rules (no cycles, one front page, slug and date
/// defaults) live in <see cref="IPageBll"/>, not here.
/// </summary>
[ApiController]
[Route("api/pages")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class PagesController(IEntityPresenter<Page> presenter) : EntityControllerBase<Page>
{
    [HttpGet]
    public Task<ActionResult<EntityGridModel>> List([FromQuery] EntityGridQuery query, CancellationToken cancellationToken) =>
        GridAsync(presenter, query, cancellationToken);

    [HttpGet("new")]
    public Task<ActionResult<EntityFormModel>> New(CancellationToken cancellationToken) =>
        NewFormAsync(presenter, cancellationToken);

    [HttpGet("{id}")]
    public async Task<ActionResult<EntityFormModel>> Get(string id, CancellationToken cancellationToken)
    {
        var form = await presenter.GetFormAsync(id, cancellationToken);
        return form is null ? NotFound() : Ok(WithFieldLookups(form, selfId: id));
    }

    [HttpPost]
    public async Task<ActionResult<EntityFormModel>> Create([FromBody] EntityDataModel request, CancellationToken cancellationToken)
    {
        var result = await CreateAsync(presenter, request, cancellationToken);
        return result.Result is ObjectResult { Value: EntityFormModel created } created201
            ? StatusCode(created201.StatusCode ?? 201, WithFieldLookups(created, selfId: created.Entity.EntityId))
            : result;
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<EntityFormModel>> Update(string id, [FromBody] EntityDataModel request, CancellationToken cancellationToken)
    {
        var result = await UpdateAsync(presenter, id, request, cancellationToken);
        return result.Result is OkObjectResult { Value: EntityFormModel updated } ? Ok(WithFieldLookups(updated, selfId: id)) : result;
    }

    [HttpDelete("{id}")]
    public Task<IActionResult> Delete(string id, CancellationToken cancellationToken) =>
        DeleteEntityAsync(presenter, id, cancellationToken);
}
