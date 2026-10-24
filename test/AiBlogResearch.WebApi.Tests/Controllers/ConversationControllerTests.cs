// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Security.Claims;
using Adventures.Entities;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

/// <summary>The conversation endpoint: the author comes from the token, never from the body; the kind defaults to a comment.</summary>
public sealed class ConversationControllerTests
{
    private sealed class RecordingConversation : IConversation
    {
        public (string PostId, string Author, string Kind, string Body)? Added;

        public Task<IReadOnlyList<ConversationEntry>> ListAsync(string postId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ConversationEntry>>([new ConversationEntry("c1", "Claude", "Comment", "2026-10-23T10:00:00.0000000+00:00", "hi")]);

        public Task<IReadOnlyList<DecisionEntry>> ListDecisionsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<DecisionEntry>>([new DecisionEntry("c9", "p1", "Review summary", "review-summary", "Admin", "2026-10-23T12:00:00.0000000+00:00", "Go ahead")]);

        public Task<ConversationEntry> AddAsync(string postId, string author, string kind, string body, CancellationToken cancellationToken = default)
        {
            Added = (postId, author, kind, body);
            return Task.FromResult(new ConversationEntry("c2", author, kind, "2026-10-23T11:00:00.0000000+00:00", body));
        }
    }

    private static (ConversationController Controller, RecordingConversation Conversation) Build(string? user)
    {
        var conversation = new RecordingConversation();
        var principal = user is null
            ? new ClaimsPrincipal(new ClaimsIdentity())
            : new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, user)], "test"));
        return (new ConversationController(conversation) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } } }, conversation);
    }

    [Fact]
    public async Task Adding_UsesTheSignedInNameAsTheAuthor_AndDefaultsTheKindToAComment()
    {
        var (controller, conversation) = Build("Admin");

        var result = await controller.Add("p1", new NewConversationEntry("Approved, go ahead", null), CancellationToken.None);

        Assert.Equal(StatusCodes.Status201Created, ((ObjectResult)result).StatusCode);
        Assert.Equal(("p1", "Admin", "Comment", "Approved, go ahead"), conversation.Added);
    }

    [Fact]
    public async Task AKindIsPassedThrough_SoTheHumanCanRecordADecision()
    {
        var (controller, conversation) = Build("Admin");

        await controller.Add("p1", new NewConversationEntry("Site settings go ahead", "Decision"), CancellationToken.None);

        Assert.Equal("Decision", conversation.Added!.Value.Kind);
    }

    [Fact]
    public async Task TheDecisionsPage_ListsDecisionsWithTheirPost_ForAdministratorsOnly()
    {
        var (_, conversation) = Build("Admin");
        var controller = new DecisionsController(conversation);

        var result = Assert.IsType<OkObjectResult>((await controller.List(CancellationToken.None)).Result);

        Assert.Equal("Review summary", Assert.Single((IReadOnlyList<DecisionEntry>)result.Value!).PostTitle);
        var authorize = Assert.Single(typeof(DecisionsController).GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), true).Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>());
        Assert.Equal(Adventures.Security.WellKnownClaims.TenantAdminPolicy, authorize.Policy);
    }

    [Fact]
    public async Task Reading_ReturnsTheThread()
    {
        var (controller, _) = Build("Admin");

        var thread = Assert.IsType<OkObjectResult>((await controller.List("p1", CancellationToken.None)).Result);

        Assert.Single((IReadOnlyList<ConversationEntry>)thread.Value!);
    }
}
