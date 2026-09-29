using Adventures.Entities;
using AiBlogResearch.WebApi.Presenters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// Self-service profile: same routes as before ("me"), now backed by the schema-driven
/// Adventures.Entities/NQuadEntityRepository stack instead of the older entities/standard_fields
/// JSONB one - so the existing Angular page keeps working while it moves onto EntityFormModel.
/// The caller is resolved by Username (the JWT's Name claim, same one AuthController.WhoAmI reads),
/// not the "sub" GUID - that GUID belongs to the older Postgres-identity user record, a different
/// id space from the new Adventures.Entities.User's own entity id.
/// </summary>
[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController(IUserPresenter presenter) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<EntityFormModel>> Me(CancellationToken cancellationToken)
    {
        var userName = ResolveUserName();
        if (userName is null)
        {
            return Unauthorized();
        }

        var form = await presenter.GetFormByUserNameAsync(userName, cancellationToken);
        return form is null ? NotFound() : Ok(form);
    }

    [HttpPut("me")]
    public async Task<ActionResult<EntityFormModel>> UpdateMe([FromBody] EntityDataModel request, CancellationToken cancellationToken)
    {
        var userName = ResolveUserName();
        if (userName is null)
        {
            return Unauthorized();
        }

        var current = await presenter.GetFormByUserNameAsync(userName, cancellationToken);
        if (current is null)
        {
            return NotFound();
        }

        var updated = await presenter.UpdateAsync(current.Entity.EntityId, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    /// <summary>
    /// Demonstrates the delete-own-account guard end to end: this always targets the caller's own
    /// id, so IUserBll.DeleteAsync always rejects it. A future "deactivate my account" feature
    /// (noted as later work) is a different, deliberate action - not this endpoint.
    /// </summary>
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMe(CancellationToken cancellationToken)
    {
        var userName = ResolveUserName();
        if (userName is null)
        {
            return Unauthorized();
        }

        var current = await presenter.GetFormByUserNameAsync(userName, cancellationToken);
        if (current is null)
        {
            return NotFound();
        }

        try
        {
            await presenter.DeleteAsync(current.Entity.EntityId, current.Entity.EntityId, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
    }

    private string? ResolveUserName() =>
        string.IsNullOrWhiteSpace(User.Identity?.Name) ? null : User.Identity!.Name;
}
