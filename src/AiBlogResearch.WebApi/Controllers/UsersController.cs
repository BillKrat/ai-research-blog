// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Entities;
using Adventures.Identity;
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
[RequireRight(Rights.UsersManage)]
public sealed class UsersController(
    IUserPresenter presenter, IEntityRelationWriter relationWriter, EntitySchemaOf<User> userSchema,
    IUserProvisioning provisioning, IConfiguration configuration, ILogger<UsersController> logger) : EntityControllerBase<User>
{
    [HttpGet]
    public Task<ActionResult<EntityGridModel>> List([FromQuery] EntityGridQuery query, CancellationToken cancellationToken) =>
        GridAsync(presenter, query, cancellationToken);

    /// <summary>The blank form for adding a person (the user name is typed here and fixed afterwards).</summary>
    [HttpGet("new")]
    public async Task<ActionResult<EntityFormModel>> New(CancellationToken cancellationToken) =>
        await presenter.GetNewFormAsync(cancellationToken) is { } blank ? Ok(blank) : NotFound();

    [HttpGet("{id}")]
    public async Task<ActionResult<EntityFormModel>> Get(string id, CancellationToken cancellationToken)
    {
        var form = await presenter.GetFormAsync(id, cancellationToken);
        if (form is null)
        {
            return NotFound();
        }

        var path = Request.Path.Value!.TrimEnd('/');
        return Ok(WithRelationLinks(form, path) with
        {
            Actions =
            [
                new EntityAction(
                    "set-password", "Set password", $"{path}/set-password",
                    "Generate a new password for this person? It is shown once, replaces the old one, and must be changed at the first sign-in."),
            ],
        });
    }

    /// <summary>
    /// Gives the person a way to sign in: creates their identity account when they have none (without roles) and sets a generated first
    /// password, returned once and never stored or logged in the clear. The person must change it at the first sign-in.
    /// </summary>
    [HttpPost("{id}/set-password")]
    public async Task<IActionResult> SetPassword(string id, CancellationToken cancellationToken)
    {
        var form = await presenter.GetFormAsync(id, cancellationToken);
        if (form is null)
        {
            return NotFound();
        }

        string Value(string name) => form.Entity.Values.FirstOrDefault(v => string.Equals(v.Key, name, StringComparison.OrdinalIgnoreCase)).Value ?? string.Empty;
        var userName = Value("UserName");
        if (string.IsNullOrWhiteSpace(userName))
        {
            return Problem(title: "This person has no user name, so there is nothing to sign in with.", statusCode: StatusCodes.Status400BadRequest);
        }

        var tenant = configuration["Auth:Tenant"] ?? "global-webnet.com";
        var login = await provisioning.SetInitialPasswordAsync(tenant, userName, Value("Email"), Value("DisplayName"), cancellationToken);
        logger.LogInformation("Password set for {UserName} (account created: {Created}) by {Administrator}", login.Username, login.AccountCreated, User.Identity?.Name);
        Response.Headers.CacheControl = "no-store";
        return Ok(new { login.Username, login.Password, login.AccountCreated, MustChangeAtFirstSignIn = true });
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
