using Adventures.Entities;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

public sealed record TermRequest(string? Name);

/// <summary>
/// The drafts-only authoring surface for Claude (machine identity <c>claude-author</c>, scope <c>content.draft</c>), reached
/// directly or through the MCP server write tools. It can create and revise drafts of its own posts, list them, and list and
/// create categories and tags by name. It has no route to publish a post, to change a published one, or to change anyone
/// else's: those stay administrator actions in the admin (see <see cref="IContentAuthoring"/>). Every post is authored by the
/// configured author account (<c>Authoring:AuthorUserName</c>, default "Claude"), whichever client calls.
/// </summary>
[ApiController]
[Route("api/author")]
[Authorize(Policy = "Scope:" + RequiredScope)]
public sealed class AuthoringController(IContentAuthoring authoring, IConfiguration configuration) : ApiControllerBase
{
    public const string RequiredScope = "content.draft";

    private string Author => configuration["Authoring:AuthorUserName"] ?? "Claude";

    [HttpGet("posts")]
    public async Task<ActionResult<IReadOnlyList<DraftSummary>>> Mine(CancellationToken cancellationToken) =>
        Ok(await authoring.ListMineAsync(Author, cancellationToken));

    [HttpPost("posts")]
    public Task<IActionResult> Create([FromBody] DraftPost draft, CancellationToken cancellationToken) =>
        GuardedAsync(async () => (IActionResult)StatusCode(StatusCodes.Status201Created, await authoring.CreateDraftAsync(Author, draft, cancellationToken)));

    [HttpPut("posts/{id}")]
    public Task<IActionResult> Update(string id, [FromBody] DraftPost draft, CancellationToken cancellationToken) =>
        GuardedAsync(async () =>
        {
            var updated = await authoring.UpdateDraftAsync(Author, id, draft, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        });

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<TaxonomyTerm>>> Categories(CancellationToken cancellationToken) =>
        Ok(await authoring.ListCategoriesAsync(cancellationToken));

    [HttpPost("categories")]
    public Task<IActionResult> EnsureCategory([FromBody] TermRequest request, CancellationToken cancellationToken) =>
        string.IsNullOrWhiteSpace(request.Name)
            ? Task.FromResult<IActionResult>(BadRequest("A name is required."))
            : GuardedAsync(async () => Ok(await authoring.EnsureCategoryAsync(request.Name, cancellationToken)));

    [HttpGet("tags")]
    public async Task<ActionResult<IReadOnlyList<TaxonomyTerm>>> Tags(CancellationToken cancellationToken) =>
        Ok(await authoring.ListTagsAsync(cancellationToken));

    [HttpPost("tags")]
    public Task<IActionResult> EnsureTag([FromBody] TermRequest request, CancellationToken cancellationToken) =>
        string.IsNullOrWhiteSpace(request.Name)
            ? Task.FromResult<IActionResult>(BadRequest("A name is required."))
            : GuardedAsync(async () => Ok(await authoring.EnsureTagAsync(request.Name, cancellationToken)));
}
