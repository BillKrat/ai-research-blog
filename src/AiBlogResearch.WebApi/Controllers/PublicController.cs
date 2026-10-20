using Adventures.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// The anonymous read side of the site: published posts and pages only (see <see cref="IPublicContent"/>). Nothing here accepts a
/// write, returns a draft, an id or an e-mail address; page size is capped by the service.
/// </summary>
[ApiController]
[Route("api/public")]
[AllowAnonymous]
public sealed class PublicController(IPublicContent content) : ControllerBase
{
    /// <summary>Published posts, newest first; optionally those in one category or carrying one tag.</summary>
    [HttpGet("posts")]
    public async Task<ActionResult<PublicPostList>> Posts(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? category = null, [FromQuery] string? tag = null, CancellationToken cancellationToken = default) =>
        Ok(await content.ListPostsAsync(page, pageSize, string.IsNullOrWhiteSpace(category) ? null : category, string.IsNullOrWhiteSpace(tag) ? null : tag, cancellationToken));

    [HttpGet("posts/{slug}")]
    public async Task<ActionResult<PublicPost>> Post(string slug, CancellationToken cancellationToken) =>
        await content.GetPostAsync(slug, cancellationToken) is { } post ? Ok(post) : NotFound();

    [HttpGet("pages/{slug}")]
    public async Task<ActionResult<PublicPage>> Page(string slug, CancellationToken cancellationToken) =>
        await content.GetPageAsync(slug, cancellationToken) is { } page ? Ok(page) : NotFound();

    /// <summary>The page marked as the front page; 404 when there is none (the site then shows the post list).</summary>
    [HttpGet("home")]
    public async Task<ActionResult<PublicPage>> Home(CancellationToken cancellationToken) =>
        await content.GetFrontPageAsync(cancellationToken) is { } page ? Ok(page) : NotFound();

    [HttpGet("menu")]
    public async Task<ActionResult<IReadOnlyList<PublicMenuItem>>> Menu(CancellationToken cancellationToken) =>
        Ok(await content.GetMenuAsync(cancellationToken));

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<PublicTerm>>> Categories(CancellationToken cancellationToken) =>
        Ok(await content.GetCategoriesAsync(cancellationToken));

    [HttpGet("tags")]
    public async Task<ActionResult<IReadOnlyList<PublicTerm>>> Tags(CancellationToken cancellationToken) =>
        Ok(await content.GetTagsAsync(cancellationToken));
}
