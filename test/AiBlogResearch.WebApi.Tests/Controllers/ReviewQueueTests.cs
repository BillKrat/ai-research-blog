using Adventures.Entities;
using AiBlogResearch.WebApi.Controllers;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public sealed class ReviewQueueTests
{
    private sealed class FakeContent(params PublicPostSummary[] posts) : IPublicContent
    {
        public string? CategoryAsked;
        public bool? DraftsAsked;

        public Task<PublicPostList> ListPostsAsync(int page, int pageSize, string? category, string? tag, CancellationToken cancellationToken = default, bool includeDrafts = false)
        {
            CategoryAsked = category;
            DraftsAsked = includeDrafts;
            return Task.FromResult(new PublicPostList(posts.Skip((page - 1) * pageSize).Take(pageSize).ToList(), page, pageSize, posts.Length));
        }

        public Task<PublicPost?> GetPostAsync(string slug, CancellationToken cancellationToken = default, bool includeDrafts = false) => Task.FromResult<PublicPost?>(null);

        public Task<PublicPage?> GetPageAsync(string slug, CancellationToken cancellationToken = default, bool includeDrafts = false) => Task.FromResult<PublicPage?>(null);

        public Task<PublicPage?> GetFrontPageAsync(CancellationToken cancellationToken = default) => Task.FromResult<PublicPage?>(null);

        public Task<IReadOnlyList<PublicMenuItem>> GetMenuAsync(CancellationToken cancellationToken = default, bool includeDrafts = false) =>
            Task.FromResult<IReadOnlyList<PublicMenuItem>>([]);

        public Task<IReadOnlyList<PublicTerm>> GetCategoriesAsync(CancellationToken cancellationToken = default, bool includeDrafts = false) =>
            Task.FromResult<IReadOnlyList<PublicTerm>>([]);

        public Task<IReadOnlyList<PublicTerm>> GetTagsAsync(CancellationToken cancellationToken = default, bool includeDrafts = false) =>
            Task.FromResult<IReadOnlyList<PublicTerm>>([]);
    }

    private static PublicPostSummary Post(string title, bool draft) => new(title, title.ToLowerInvariant(), null, null, null, ["Collaboration"], [], draft);

    [Fact]
    public async Task OnlyDraftsOfTheCollaborationCategoryCount()
    {
        var content = new FakeContent(Post("A", true), Post("B", false), Post("C", true));

        var waiting = await ReviewQueue.CountAsync(content, CancellationToken.None);

        Assert.Equal(2, waiting);
        Assert.Equal("Collaboration", content.CategoryAsked);
        Assert.True(content.DraftsAsked);
    }

    [Fact]
    public async Task ManyPostsArePagedThrough()
    {
        var many = Enumerable.Range(1, 120).Select(i => Post($"P{i}", draft: i % 2 == 0)).ToArray();

        Assert.Equal(60, await ReviewQueue.CountAsync(new FakeContent(many), CancellationToken.None));
    }

    [Fact]
    public async Task NothingWaiting_IsZero()
    {
        Assert.Equal(0, await ReviewQueue.CountAsync(new FakeContent(), CancellationToken.None));
    }
}
