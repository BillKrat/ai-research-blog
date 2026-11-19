using Adventures.Diagnostics.WebApi;
// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Adventures.Security;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public sealed class AdminExceptionsControllerTests
{
    private sealed class FakePresenter : Adventures.Entities.IExceptionLogPresenter
    {
        public (string Kind, bool Purged)? DrillDown { get; private set; }
        public bool PlainGridAsked { get; private set; }
        public bool HistoryAsked { get; private set; }

        private static readonly Adventures.Entities.EntityGridModel Empty = new(new Adventures.Entities.EntitySchemaModel("urn:test", []), []);

        public Task<Adventures.Entities.EntityGridModel> GetSignatureGridAsync(string signatureId, bool includePurged, CancellationToken cancellationToken = default)
        {
            DrillDown = (signatureId, includePurged);
            return Task.FromResult(Empty);
        }

        public Task<Adventures.Entities.EntityGridModel> GetGridAsync(CancellationToken cancellationToken = default)
        {
            PlainGridAsked = true;
            return Task.FromResult(Empty);
        }

        public Task<Adventures.Entities.EntityGridModel> GetHistoryGridAsync(CancellationToken cancellationToken = default)
        {
            HistoryAsked = true;
            return Task.FromResult(Empty);
        }

        public Task<Adventures.Entities.EntityGridModel> GetGridAsync(Adventures.Entities.EntityGridQuery query, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<Adventures.Entities.EntityFormModel?> GetFormAsync(string id, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<Adventures.Entities.EntityFormModel?> GetNewFormAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<IReadOnlyList<Adventures.Entities.EntityDataModel>> ListAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<Adventures.Entities.EntityFormModel> CreateAsync(Adventures.Entities.EntityDataModel data, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<Adventures.Entities.EntityFormModel?> UpdateAsync(string id, Adventures.Entities.EntityDataModel data, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<int> CountTotalAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<int> CountActiveAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<int> PurgeAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    [Fact]
    public async Task AKindOfFailureCanBeDrilledInto_WithOrWithoutThePurgedHistory()
    {
        var presenter = new FakePresenter();
        var controller = new AdminExceptionsController(presenter, null!);

        await controller.Grid(includePurged: true, signature: "kind-1");

        Assert.Equal(("kind-1", true), presenter.DrillDown);
        Assert.False(presenter.PlainGridAsked);
        Assert.False(presenter.HistoryAsked);
    }

    [Fact]
    public async Task WithNoKindTheGridIsAsBefore()
    {
        var presenter = new FakePresenter();
        var controller = new AdminExceptionsController(presenter, null!);

        await controller.Grid();
        await controller.Grid(includePurged: true);

        Assert.True(presenter.PlainGridAsked);
        Assert.True(presenter.HistoryAsked);
        Assert.Null(presenter.DrillDown);
    }

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
