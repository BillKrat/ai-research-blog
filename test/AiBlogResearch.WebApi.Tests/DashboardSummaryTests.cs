using Adventures.Blog.WebApi;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

public class DashboardSummaryTests
{
    private static ContentRow Row(string id, string title, bool published, bool revision = false) => new(id, title, published, revision);

    [Fact]
    public void Counts_published_and_draft_posts_and_pages_separately()
    {
        var summary = DashboardSummary.Build(
            [Row("p1", "One", true), Row("p2", "Two", false), Row("p3", "Three", true)],
            [Row("g1", "About", true), Row("g2", "Soon", false)],
            exceptions: 2, collaborationWaiting: 1, commentsPending: 4);

        Assert.Equal(2, summary.PublishedPosts);
        Assert.Equal(1, summary.DraftPosts);
        Assert.Equal(1, summary.PublishedPages);
        Assert.Equal(1, summary.DraftPages);
        Assert.Equal(2, summary.Exceptions);
        Assert.Equal(1, summary.CollaborationWaiting);
        Assert.Equal(4, summary.CommentsPending);
    }

    [Fact]
    public void A_proposed_revision_is_not_a_post_of_its_own()
    {
        var summary = DashboardSummary.Build([Row("p1", "One", true), Row("r1", "One (revision)", false, revision: true)], [], 0, 0, 0);

        Assert.Equal(1, summary.PublishedPosts);
        Assert.Equal(0, summary.DraftPosts);
        Assert.Empty(summary.DraftPostList);
    }

    [Fact]
    public void Draft_lists_hold_the_drafts_only_capped_at_the_limit()
    {
        var drafts = Enumerable.Range(1, 12).Select(n => Row($"d{n}", $"Draft {n}", false)).ToList();
        var summary = DashboardSummary.Build([Row("p1", "Live", true), .. drafts], drafts, 0, 0, 0);

        Assert.Equal(DashboardSummary.ListLimit, summary.DraftPostList.Count);
        Assert.All(summary.DraftPostList, item => Assert.StartsWith("Draft", item.Title));
        Assert.Equal(DashboardSummary.ListLimit, summary.DraftPageList.Count);
    }
}
