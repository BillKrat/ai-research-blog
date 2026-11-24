using System.Reflection;
using System.Security.Claims;
using Adventures.Blog;
using Adventures.Collaboration;
using Adventures.Common.Exceptions;
using Adventures.Entities;
using Adventures.WebApi;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>The Dashboard's Latest comments (the newest few, shortened, newest first) and Quick draft (a title and some text become a draft post of the signed-in person).</summary>
public class DashboardLatestAndQuickDraftTests
{
    private static ModerationComment Comment(int n, string body = "Nice post", string status = "Pending") =>
        new($"c{n}", "a-post", "A post", $"Visitor {n}", $"v{n}@example.org", $"2026-11-22T10:{n:00}:00+00:00", status, body);

    [Fact]
    public void TheLatestComments_AreTheFirstFive_InTheOrderGiven_AndCarryNoEmailAddress()
    {
        var latest = DashboardSummary.Latest(Enumerable.Range(1, 9).Select(n => Comment(n)));

        Assert.Equal(5, latest.Count);
        Assert.Equal(["c1", "c2", "c3", "c4", "c5"], latest.Select(c => c.Id));
        Assert.Equal(("Visitor 1", "A post", "Pending"), (latest[0].Author, latest[0].PostTitle, latest[0].Status));
        Assert.DoesNotContain(typeof(DashboardComment).GetProperties(), p => p.Name.Contains("Email", StringComparison.Ordinal));
    }

    [Fact]
    public void ALongComment_IsShortenedToAnExcerpt_WithWhitespaceCollapsed()
    {
        var latest = DashboardSummary.Latest([Comment(1, "word  \n " + new string('x', 400))]);

        Assert.True(latest[0].Excerpt.Length <= DashboardSummary.ExcerptLength + 1);
        Assert.EndsWith("…", latest[0].Excerpt);
        Assert.StartsWith("word x", latest[0].Excerpt);
        Assert.Equal("Nice post", DashboardSummary.Latest([Comment(2)])[0].Excerpt);
    }

    [Fact]
    public void TheModel_CarriesTheLatestComments()
    {
        var model = DashboardSummary.Build([], [], 0, 0, 0, [Comment(1)]);

        Assert.Equal("c1", Assert.Single(model.LatestComments).Id);
        Assert.Empty(DashboardSummary.Build([], [], 0, 0, 0).LatestComments);
    }

    private sealed class FakeAuthoring : IContentAuthoring
    {
        public (string Author, DraftPost Draft)? Created { get; private set; }

        public Task<DraftSummary> CreateDraftAsync(string authorUserName, DraftPost draft, CancellationToken cancellationToken = default)
        {
            Created = (authorUserName, draft);
            return Task.FromResult(new DraftSummary("id1", draft.Title, "slug", false, null, [], []));
        }

        public Task<DraftSummary?> UpdateDraftAsync(string authorUserName, string postId, DraftPost draft, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<DraftSummary?> ProposeRevisionAsync(string authorUserName, string postId, DraftPost changes, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<IReadOnlyList<DraftSummary>> ListMineAsync(string authorUserName, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<IReadOnlyList<TaxonomyTerm>> ListCategoriesAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<IReadOnlyList<TaxonomyTerm>> ListTagsAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<IReadOnlyList<ConversationEntry>> ListCommentsAsync(string authorUserName, string postId, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<ConversationEntry> AddCommentAsync(string authorUserName, string postId, string text, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<TaxonomyTerm> EnsureCategoryAsync(string name, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<TaxonomyTerm> EnsureTagAsync(string name, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private static QuickDraftController As(FakeAuthoring authoring, string? user = "Bill")
    {
        var identity = user is null ? new ClaimsIdentity() : new ClaimsIdentity([new Claim(ClaimTypes.Name, user)], "test");
        return new QuickDraftController(authoring) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } } };
    }

    [Fact]
    public async Task AQuickDraft_IsADraftOfTheSignedInPerson_NeverPublished()
    {
        var authoring = new FakeAuthoring();

        var result = await As(authoring).Create(new QuickDraftRequest("  An idea ", "Some text"), CancellationToken.None);

        Assert.IsType<ObjectResult>(result);
        Assert.Equal(("Bill", "An idea", "Some text"), (authoring.Created!.Value.Author, authoring.Created.Value.Draft.Title, authoring.Created.Value.Draft.Content));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ADraftNeedsATitle(string? title)
    {
        var authoring = new FakeAuthoring();

        var result = await As(authoring).Create(new QuickDraftRequest(title, "text"), CancellationToken.None);

        Assert.IsNotType<ObjectResult>(result);
        Assert.Null(authoring.Created);
    }

    [Fact]
    public async Task TooMuchText_IsRefused_BeforeAnythingIsStored()
    {
        var authoring = new FakeAuthoring();

        Assert.IsNotType<ObjectResult>(await As(authoring).Create(new QuickDraftRequest(new string('t', QuickDraftController.MaxTitle + 1), "x"), CancellationToken.None));
        Assert.IsNotType<ObjectResult>(await As(authoring).Create(new QuickDraftRequest("T", new string('x', QuickDraftController.MaxContent + 1)), CancellationToken.None));
        Assert.Null(authoring.Created);
    }

    [Fact]
    public async Task WithNoSignedInName_NothingIsCreated()
    {
        var authoring = new FakeAuthoring();

        Assert.IsType<ForbidResult>(await As(authoring, user: null).Create(new QuickDraftRequest("T", "x"), CancellationToken.None));
        Assert.Null(authoring.Created);
    }

    [Fact]
    public void QuickDraft_NeedsTheRightToWriteAPost_AndHasNoPublishRoute()
    {
        var controller = typeof(QuickDraftController);
        Assert.Contains(controller.GetCustomAttributes<RequireRightAttribute>(), a => a.Right == Rights.PostsCreate);
        Assert.DoesNotContain(controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly), m => m.Name.Contains("Publish", StringComparison.Ordinal));
    }
}
