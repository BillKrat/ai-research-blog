using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>The text and kind of a new entry in a post's conversation; the kind defaults to a plain comment.</summary>
public sealed record NewConversationEntry(string? Text, string? Kind);

/// <summary>
/// The conversation under a post for administrators: read it, and add to it as the signed-in user (the author and the time are the
/// server's, never the caller's). Entries are only added; a decision is an entry of kind Decision that the human records.
/// </summary>
[ApiController]
[Route("api/posts/{postId}/comments")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class ConversationController(IConversation conversation) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ConversationEntry>>> List(string postId, CancellationToken cancellationToken) =>
        Ok(await conversation.ListAsync(postId, cancellationToken));

    [HttpPost]
    public Task<IActionResult> Add(string postId, [FromBody] NewConversationEntry entry, CancellationToken cancellationToken) =>
        GuardedAsync(async () => (IActionResult)StatusCode(
            StatusCodes.Status201Created,
            await conversation.AddAsync(postId, User.Identity?.Name ?? "unknown", string.IsNullOrWhiteSpace(entry.Kind) ? CommentKinds.Comment : entry.Kind, entry.Text ?? string.Empty, cancellationToken)));
}
