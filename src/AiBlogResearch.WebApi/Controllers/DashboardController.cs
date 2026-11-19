using Adventures.Blog;
using Adventures.Collaboration;
using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>One post or page as the dashboard needs it: no content, just what the counts and the draft lists read.</summary>
public sealed record ContentRow(string Id, string Title, bool IsPublished, bool IsRevision);

public sealed record DashboardItem(string Id, string Title);

/// <summary>What the admin Dashboard shows (the legacy BlogEngine dashboard, trimmed for the beta): counts, the drafts, and what waits for a person.</summary>
public sealed record DashboardModel(
    int PublishedPosts,
    int DraftPosts,
    int PublishedPages,
    int DraftPages,
    int Exceptions,
    int CollaborationWaiting,
    int CommentsPending,
    IReadOnlyList<DashboardItem> DraftPostList,
    IReadOnlyList<DashboardItem> DraftPageList);

/// <summary>Builds the dashboard numbers from plain rows, so the rules (a proposed revision is not a post; drafts are capped) are tested without a store.</summary>
public static class DashboardSummary
{
    public const int ListLimit = 8;

    public static DashboardModel Build(
        IEnumerable<ContentRow> posts, IEnumerable<ContentRow> pages, int exceptions, int collaborationWaiting, int commentsPending)
    {
        var realPosts = posts.Where(post => !post.IsRevision).ToList();
        var pageList = pages.ToList();
        return new DashboardModel(
            realPosts.Count(post => post.IsPublished),
            realPosts.Count(post => !post.IsPublished),
            pageList.Count(page => page.IsPublished),
            pageList.Count(page => !page.IsPublished),
            exceptions,
            collaborationWaiting,
            commentsPending,
            Drafts(realPosts),
            Drafts(pageList));
    }

    private static IReadOnlyList<DashboardItem> Drafts(IEnumerable<ContentRow> rows) =>
        rows.Where(row => !row.IsPublished).Take(ListLimit).Select(row => new DashboardItem(row.Id, row.Title)).ToList();
}

/// <summary>The admin Dashboard: one read-only call. Administrators only.</summary>
[ApiController]
[Route("api/admin/dashboard")]
[RequireRight(Rights.AdminAccess)]
public sealed class DashboardController(
    IEntityBll<Post> posts, IPageBll pages, IExceptionLogPresenter exceptions, ICollaborationBll collaboration, IVisitorComments comments) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardModel>> Get(CancellationToken cancellationToken)
    {
        var postRows = (await posts.ListAsync(cancellationToken)).Select(ToRow);
        var pageRows = (await pages.ListAsync(cancellationToken)).Select(ToRow);
        return Ok(DashboardSummary.Build(
            postRows,
            pageRows,
            await exceptions.CountActiveAsync(cancellationToken),
            await ReviewQueue.CountItemsAsync(collaboration, cancellationToken),
            commentsPending: await comments.CountPendingAsync(cancellationToken)));
    }

    private static ContentRow ToRow(DynamicEntity entity) => new(
        entity.EntityId?.Value ?? string.Empty,
        entity.GetValue("Title") as string ?? string.Empty,
        entity.GetValue("IsPublished") is true,
        !string.IsNullOrEmpty(entity.GetValue("RevisionOf") as string));
}
