// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Security;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public sealed class AdminExceptionsControllerTests
{
    [Fact]
    public void Controller_NeedsTheDiagnosticsRight()
    {
        var guard = Assert.Single(
            typeof(AdminExceptionsController).GetCustomAttributes(typeof(Adventures.WebApi.RequireRightAttribute), inherit: true).Cast<Adventures.WebApi.RequireRightAttribute>());

        Assert.Equal(Adventures.Entities.Rights.DiagnosticsRead, guard.Right);
    }

    [Fact]
    public void NoActionIsAnonymous()
    {
        var anonymous = typeof(AdminExceptionsController).GetMethods()
            .Where(m => m.GetCustomAttributes(typeof(AllowAnonymousAttribute), true).Length > 0);

        Assert.Empty(anonymous);
    }
}
