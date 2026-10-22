using System.Security.Claims;
using Adventures.Entities;
using Adventures.Security;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

/// <summary>Drafts reach the reader only through a token that passes the administrator policy; an anonymous call, or a signed-in non-administrator, gets published content only.</summary>
public sealed class PublicControllerTests
{
    private sealed class RecordingContent : IPublicContent
    {
        public bool? PostsIncludeDrafts;
        public bool? PostIncludeDrafts;
        public bool? PageIncludeDrafts;
        public bool? MenuIncludeDrafts;

        public Task<PublicPostList> ListPostsAsync(int page, int pageSize, string? category, string? tag, CancellationToken cancellationToken = default, bool includeDrafts = false)
        {
            PostsIncludeDrafts = includeDrafts;
            return Task.FromResult(new PublicPostList([], 1, pageSize, 0));
        }

        public Task<PublicPost?> GetPostAsync(string slug, CancellationToken cancellationToken = default, bool includeDrafts = false)
        {
            PostIncludeDrafts = includeDrafts;
            return Task.FromResult<PublicPost?>(null);
        }

        public Task<PublicPage?> GetPageAsync(string slug, CancellationToken cancellationToken = default, bool includeDrafts = false)
        {
            PageIncludeDrafts = includeDrafts;
            return Task.FromResult<PublicPage?>(null);
        }

        public Task<PublicPage?> GetFrontPageAsync(CancellationToken cancellationToken = default) => Task.FromResult<PublicPage?>(null);

        public Task<IReadOnlyList<PublicMenuItem>> GetMenuAsync(CancellationToken cancellationToken = default, bool includeDrafts = false)
        {
            MenuIncludeDrafts = includeDrafts;
            return Task.FromResult<IReadOnlyList<PublicMenuItem>>([]);
        }

        public Task<IReadOnlyList<PublicTerm>> GetCategoriesAsync(CancellationToken cancellationToken = default, bool includeDrafts = false) =>
            Task.FromResult<IReadOnlyList<PublicTerm>>([]);

        public Task<IReadOnlyList<PublicTerm>> GetTagsAsync(CancellationToken cancellationToken = default, bool includeDrafts = false) =>
            Task.FromResult<IReadOnlyList<PublicTerm>>([]);
    }

    private sealed class FakeAuthorization(bool succeeds) : IAuthorizationService
    {
        public string? PolicyAsked;

        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements) =>
            Task.FromResult(succeeds ? AuthorizationResult.Success() : AuthorizationResult.Failed());

        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName)
        {
            PolicyAsked = policyName;
            return Task.FromResult(succeeds ? AuthorizationResult.Success() : AuthorizationResult.Failed());
        }
    }

    private static (PublicController Controller, RecordingContent Content, FakeAuthorization Authorization) Build(bool signedIn, bool policyPasses)
    {
        var content = new RecordingContent();
        var authorization = new FakeAuthorization(policyPasses);
        var principal = signedIn
            ? new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "someone")], "test"))
            : new ClaimsPrincipal(new ClaimsIdentity());
        var controller = new PublicController(content, authorization)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } },
        };
        return (controller, content, authorization);
    }

    [Fact]
    public async Task AnAdministrator_GetsDraftsOnEveryRead_AndThePolicyAskedIsTheAdminPolicy()
    {
        var (controller, content, authorization) = Build(signedIn: true, policyPasses: true);

        await controller.Posts();
        await controller.Post("x", CancellationToken.None);
        await controller.Page("x", CancellationToken.None);
        await controller.Menu(CancellationToken.None);

        Assert.True(content.PostsIncludeDrafts);
        Assert.True(content.PostIncludeDrafts);
        Assert.True(content.PageIncludeDrafts);
        Assert.True(content.MenuIncludeDrafts);
        Assert.Equal(WellKnownClaims.TenantAdminPolicy, authorization.PolicyAsked);
    }

    [Fact]
    public async Task AVisitorGetsNoDrafts_AndTheAdminPolicyIsNotEvenAsked()
    {
        var (controller, content, authorization) = Build(signedIn: false, policyPasses: true);

        await controller.Posts();
        await controller.Post("x", CancellationToken.None);
        await controller.Menu(CancellationToken.None);

        Assert.False(content.PostsIncludeDrafts);
        Assert.False(content.PostIncludeDrafts);
        Assert.False(content.MenuIncludeDrafts);
        Assert.Null(authorization.PolicyAsked);
    }

    [Fact]
    public async Task ASignedInNonAdministrator_GetsNoDrafts()
    {
        var (controller, content, _) = Build(signedIn: true, policyPasses: false);

        await controller.Posts();
        await controller.Page("x", CancellationToken.None);

        Assert.False(content.PostsIncludeDrafts);
        Assert.False(content.PageIncludeDrafts);
    }
}
