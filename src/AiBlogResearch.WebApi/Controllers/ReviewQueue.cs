using Adventures.Entities;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// What waits for the human's review in the collaboration channel (backlog: the blog as the human and AI collaboration channel): the
/// posts in the category <see cref="PostApproval.CollaborationCategory"/> whose review state is <see cref="PostApproval.NeedsReview"/>.
/// The count is the admin menu badge on Posts; an approved post, or one sent back with a request for changes, no longer waits for the human.
/// </summary>
public static class ReviewQueue
{
    private const int PageSize = 50;

    /// <summary>The Developer collaboration items whose review state is Needs review.</summary>
    public static async Task<int> CountItemsAsync(ICollaborationBll items, CancellationToken cancellationToken) =>
        (await items.ListAsync(cancellationToken)).Count(item =>
            item.GetValue("Kind") as string == CollaborationKinds.Developer && item.GetValue("Approval") as string == PostApproval.NeedsReview);

    public static async Task<int> CountAsync(IPublicContent content, CancellationToken cancellationToken)
    {
        var waiting = 0;
        for (var page = 1; ; page++)
        {
            var list = await content.ListPostsAsync(page, PageSize, PostApproval.CollaborationCategory, tag: null, cancellationToken, includeDrafts: true);
            waiting += list.Posts.Count(post => post.Approval == PostApproval.NeedsReview);
            if (page * PageSize >= list.Total || list.Posts.Count == 0)
            {
                return waiting;
            }
        }
    }
}
