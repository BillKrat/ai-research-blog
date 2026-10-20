using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// Full CRUDL over User - administrators only (the TenantAdmin role; every other signed-in user is refused with 403,
/// self-service stays on <see cref="ProfileController"/>), on the schema-driven Adventures.Entities/NQuadEntityRepository stack. The
/// only business rule (you cannot delete your own account) lives in IUserBll, not here; this
/// controller only resolves the current user id (from the same claim AuthController.WhoAmI reads)
/// to pass to it. Get/List/Create/Update delegate straight to the promoted EntityControllerBase{User}
/// helpers from Adventures.WebApi - Delete stays bespoke since the guard needs the acting user id.
/// </summary>
[ApiController]
[Route("api/users")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class UsersController(IUserPresenter presenter, IEntityRelationWriter relationWriter, EntitySchemaOf<User> userSchema) : EntityControllerBase<User>
{
    [HttpGet]
    public Task<ActionResult<EntityGridModel>> List([FromQuery] EntityGridQuery query, CancellationToken cancellationToken) =>
        GridAsync(presenter, query, cancellationToken);

    [HttpGet("{id}")]
    public async Task<ActionResult<EntityFormModel>> Get(string id, CancellationToken cancellationToken)
    {
        var form = await presenter.GetFormAsync(id, cancellationToken);
        return form is null ? NotFound() : Ok(WithRelationLinks(form, $"{Request.Path.Value!.TrimEnd('/')}"));
    }

    /// <summary>Adds a role assignment (or any child of a declared relation) to the user: each child is saved through its own endpoint and rules, never as part of the user.</summary>
    [HttpPost("{id}/relations/{relationName}")]
    public Task<IActionResult> AddRelationChild(string id, string relationName, [FromBody] EntityDataModel request, CancellationToken cancellationToken) =>
        AddRelationChildAsync(relationWriter, userSchema.Schema, id, relationName, request, cancellationToken);

    [HttpDelete("{id}/relations/{relationName}/{childId}")]
    public Task<IActionResult> RemoveRelationChild(string id, string relationName, string childId, CancellationToken cancellationToken) =>
        RemoveRelationChildAsync(relationWriter, userSchema.Schema, id, relationName, childId, cancellationToken);

    [HttpPost]
    public Task<ActionResult<EntityFormModel>> Create([FromBody] EntityDataModel request, CancellationToken cancellationToken) =>
        CreateAsync(presenter, request, cancellationToken);

    [HttpPut("{id}")]
    public Task<ActionResult<EntityFormModel>> Update(string id, [FromBody] EntityDataModel request, CancellationToken cancellationToken) =>
        UpdateAsync(presenter, id, request, cancellationToken);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var currentUserId = await ResolveCurrentUserIdAsync(cancellationToken);
        if (currentUserId is null)
        {
            return Unauthorized();
        }

        return await GuardedAsync(async () =>
        {
            var deleted = await presenter.DeleteAsync(id, currentUserId, cancellationToken);
            return deleted ? NoContent() : NotFound();
        });
    }

    private async Task<string?> ResolveCurrentUserIdAsync(CancellationToken cancellationToken)
    {
        var userName = User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(userName))
        {
            return null;
        }

        var form = await presenter.GetFormByUserNameAsync(userName, cancellationToken);
        return form?.Entity.EntityId;
    }
}
