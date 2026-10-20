using Adventures.Common.Exceptions;
using Adventures.Entities;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public sealed class AuthoringControllerTests
{
    private sealed class FakeAuthoring : IContentAuthoring
    {
        public (string Author, DraftPost Draft)? LastCreate { get; private set; }

        public Exception? Throw { get; set; }

        public bool Missing { get; set; }

        private static DraftSummary Summary(string id = "p1") => new(id, "T", "t", false, null, [], []);

        public Task<DraftSummary> CreateDraftAsync(string authorUserName, DraftPost draft, CancellationToken cancellationToken = default)
        {
            LastCreate = (authorUserName, draft);
            return Throw is null ? Task.FromResult(Summary()) : throw Throw;
        }

        public Task<DraftSummary?> UpdateDraftAsync(string authorUserName, string postId, DraftPost draft, CancellationToken cancellationToken = default) =>
            Throw is null ? Task.FromResult<DraftSummary?>(Missing ? null : Summary(postId)) : throw Throw;

        public Task<IReadOnlyList<DraftSummary>> ListMineAsync(string authorUserName, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<DraftSummary>>([Summary()]);

        public Task<IReadOnlyList<TaxonomyTerm>> ListCategoriesAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<TaxonomyTerm>>([]);

        public Task<IReadOnlyList<TaxonomyTerm>> ListTagsAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<TaxonomyTerm>>([]);

        public Task<TaxonomyTerm> EnsureCategoryAsync(string name, CancellationToken cancellationToken = default) => Task.FromResult(new TaxonomyTerm("c1", name));

        public Task<TaxonomyTerm> EnsureTagAsync(string name, CancellationToken cancellationToken = default) => Task.FromResult(new TaxonomyTerm("t1", name));
    }

    private static AuthoringController Build(FakeAuthoring authoring, string? configuredAuthor = null) =>
        new(authoring, new ConfigurationBuilder().AddInMemoryCollection(configuredAuthor is null ? [] : new Dictionary<string, string?> { ["Authoring:AuthorUserName"] = configuredAuthor }).Build());

    [Fact]
    public void ItIsProtectedByTheDraftScopeOnly_AndHasNoWayToPublish()
    {
        var authorize = Assert.Single(typeof(AuthoringController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());
        Assert.Equal("Scope:content.draft", authorize.Policy);
        Assert.DoesNotContain(typeof(AuthoringController).GetMethods(), m => m.Name.Contains("Publish", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Create_Returns201_AndAlwaysUsesTheConfiguredAuthor_DefaultingToClaude()
    {
        var authoring = new FakeAuthoring();

        var result = await Build(authoring).Create(new DraftPost("Title"), CancellationToken.None);
        Assert.Equal(201, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal("Claude", authoring.LastCreate!.Value.Author);

        await Build(authoring, "Writer").Create(new DraftPost("Title"), CancellationToken.None);
        Assert.Equal("Writer", authoring.LastCreate!.Value.Author);
    }

    [Fact]
    public async Task Update_Maps404_409_And400()
    {
        var authoring = new FakeAuthoring { Missing = true };
        var controller = Build(authoring);
        Assert.IsType<NotFoundResult>(await controller.Update("x", new DraftPost("T"), CancellationToken.None));

        authoring.Throw = new BusinessRuleException("This post is published.");
        Assert.IsType<ConflictObjectResult>(await controller.Update("x", new DraftPost("T"), CancellationToken.None));

        authoring.Throw = new InputValidationException(new Dictionary<string, string[]> { ["Title"] = ["Title is required."] });
        Assert.IsType<BadRequestObjectResult>(await controller.Update("x", new DraftPost("T"), CancellationToken.None));
    }

    [Fact]
    public async Task EnsuringATermNeedsAName()
    {
        var controller = Build(new FakeAuthoring());

        Assert.IsType<BadRequestObjectResult>(await controller.EnsureCategory(new TermRequest("  "), CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.EnsureTag(new TermRequest("MCP"), CancellationToken.None));
    }
}
