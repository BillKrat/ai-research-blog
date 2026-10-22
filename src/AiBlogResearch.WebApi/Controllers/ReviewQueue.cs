using Adventures.Entities;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// What waits for the human's review in the collaboration channel (backlog: the blog as the human and AI collaboration channel): the
/// drafts in the category <see cref="Category"/>. Claude posts review summaries there as drafts; the count is the admin menu badge on Posts.
/// </summary>
public static class ReviewQueue
{
    public const string Category = "Collaboration";

    private const int PageSize = 50;

    public static async Task<int> CountAsync(IPublicContent content, CancellationToken cancellationToken)
    {
        var waiting = 0;
        for (var page = 1; ; page++)
        {
            var list = await content.ListPostsAsync(page, PageSize, Category, tag: null, cancellationToken, includeDrafts: true);
            waiting += list.Posts.Count(post => post.IsDraft);
            if (page * PageSize >= list.Total || list.Posts.Count == 0)
            {
                return waiting;
            }
        }
    }
}
