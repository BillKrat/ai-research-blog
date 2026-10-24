using Adventures.Common.Exceptions;
using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// Collaboration items for administrators: the six standard admin actions plus <c>approve</c> and <c>request-changes</c> on a Developer
/// item. The review state is not a form field (the presenter refuses it): it changes only here, so who may review is decided in one
/// place. A collaboration item is never public, so nothing here can publish it.
/// </summary>
[ApiController]
[Route("api/collaboration")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
[RequiresPlugin(PluginCatalog.DeveloperCollaboration, PluginCatalog.ResearchCollaboration)]
public sealed class CollaborationController(IEntityPresenter<CollaborationItem> presenter, ICollaborationBll items, IUserPresenter users, CollaborationMigration migration)
    : AdminEntityControllerBase<CollaborationItem>(presenter)
{
    /// <summary>The signed-in user is the author unless the form names one.</summary>
    protected override async Task<EntityDataModel> PrepareForCreateAsync(EntityDataModel request, CancellationToken cancellationToken)
    {
        if (request.Values.TryGetValue("Author", out var author) && !string.IsNullOrEmpty(author))
        {
            return request;
        }

        var me = User.Identity?.Name is { Length: > 0 } name ? await users.GetFormByUserNameAsync(name, cancellationToken) : null;
        return me is null ? request : request with { Values = new Dictionary<string, string?>(request.Values) { ["Author"] = me.Entity.EntityId } };
    }

    protected override EntityFormModel Decorate(EntityFormModel form, string collectionPath)
    {
        var decorated = base.Decorate(form, collectionPath);
        var kind = form.Entity.Values.GetValueOrDefault("Kind");
        var approval = form.Entity.Values.GetValueOrDefault("Approval");
        if (string.IsNullOrEmpty(form.Entity.EntityId) || kind != CollaborationKinds.Developer || string.IsNullOrEmpty(approval))
        {
            return decorated;
        }

        var link = $"{collectionPath}/{Uri.EscapeDataString(form.Entity.EntityId)}";
        var actions = new List<EntityAction>();
        if (approval != PostApproval.Approved)
        {
            actions.Add(new EntityAction("approve", "Approve", $"{link}/approve", null));
        }

        if (approval != PostApproval.ChangesRequested)
        {
            actions.Add(new EntityAction("request-changes", "Request changes", $"{link}/request-changes", null));
        }

        return decorated with { Actions = actions };
    }

    [HttpPost("{id}/approve")]
    public Task<IActionResult> Approve(string id, CancellationToken cancellationToken) =>
        GuardedAsync(async () => await items.SetApprovalAsync(id, PostApproval.Approved, User.Identity?.Name, cancellationToken) ? (IActionResult)NoContent() : NotFound());

    [HttpPost("{id}/request-changes")]
    public Task<IActionResult> RequestChanges(string id, CancellationToken cancellationToken) =>
        GuardedAsync(async () => await items.SetApprovalAsync(id, PostApproval.ChangesRequested, User.Identity?.Name, cancellationToken) ? (IActionResult)NoContent() : NotFound());

    /// <summary>
    /// One-time move of the posts filed under the Collaboration category into collaboration items, keeping each id (so its conversation,
    /// decisions and review state carry over). A dry run unless <c>apply=true</c>; safe to run again (an item that already exists is not
    /// created twice, and a post is only taken out of the Posts list once its item exists).
    /// </summary>
    [HttpPost("migrate")]
    public Task<IActionResult> Migrate([FromQuery] bool apply, CancellationToken cancellationToken) =>
        GuardedAsync(async () => (IActionResult)Ok(await migration.RunAsync(apply, cancellationToken)));
}

/// <summary>The collaboration authoring surface for Claude (scope <c>content.draft</c>), next to the posts one: create, revise and list its own items and use their conversation.</summary>
[ApiController]
[Route("api/author/collaboration")]
[Authorize(Policy = "Scope:" + AuthoringController.RequiredScope)]
[RequiresPlugin(PluginCatalog.DeveloperCollaboration, PluginCatalog.ResearchCollaboration)]
public sealed class CollaborationAuthoringController(ICollaborationAuthoring authoring, IConfiguration configuration) : ApiControllerBase
{
    private string Author => configuration["Authoring:AuthorUserName"] ?? "Claude";

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CollaborationSummary>>> Mine(CancellationToken cancellationToken) =>
        Ok(await authoring.ListMineAsync(Author, cancellationToken));

    [HttpPost]
    public Task<IActionResult> Create([FromBody] CollaborationDraft draft, CancellationToken cancellationToken) =>
        GuardedAsync(async () => (IActionResult)StatusCode(StatusCodes.Status201Created, await authoring.CreateAsync(Author, draft, cancellationToken)));

    [HttpPut("{id}")]
    public Task<IActionResult> Update(string id, [FromBody] CollaborationDraft draft, CancellationToken cancellationToken) =>
        GuardedAsync(async () => await authoring.UpdateAsync(Author, id, draft, cancellationToken) is { } updated ? Ok(updated) : NotFound());

    [HttpGet("{id}/comments")]
    public Task<IActionResult> Comments(string id, CancellationToken cancellationToken) =>
        GuardedAsync(async () => (IActionResult)Ok(await authoring.ListCommentsAsync(Author, id, cancellationToken)));

    [HttpPost("{id}/comments")]
    public Task<IActionResult> AddComment(string id, [FromBody] NewConversationEntry entry, CancellationToken cancellationToken) =>
        GuardedAsync(async () => (IActionResult)StatusCode(StatusCodes.Status201Created, await authoring.AddCommentAsync(Author, id, entry.Text ?? string.Empty, cancellationToken)));
}
