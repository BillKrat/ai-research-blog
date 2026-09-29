using System.Security.Claims;
using Adventures.Entities;
using AiBlogResearch.WebApi.Presenters;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public class UsersControllerTests
{
    private const string BillId = "user-bill";
    private const string ClaudeId = "user-claude";

    private static EntityFormModel BuildForm(string id, string userName) =>
        new(
            new EntitySchemaModel("https://global-webnet.com/schema/User",
            [
                new EntityFieldSchema("UserName", "String", IsRequired: true),
            ]),
            new EntityDataModel(id, new Dictionary<string, string?> { ["UserName"] = userName }));

    [Fact]
    public async Task List_ReturnsSummariesFromThePresenter()
    {
        var presenter = new FakeUserPresenter
        {
            Summaries = [new(BillId, "BillKrat", "Bill Kratochvil"), new(ClaudeId, "Claude", "Claude")],
        };
        var controller = BuildController(presenter, callerUserName: "BillKrat");

        var result = await controller.List(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var summaries = Assert.IsAssignableFrom<IReadOnlyList<UserSummary>>(ok.Value);
        Assert.Equal(2, summaries.Count);
    }

    [Fact]
    public async Task Get_ReturnsNotFound_WhenPresenterHasNoForm()
    {
        var presenter = new FakeUserPresenter { FormById = null };
        var controller = BuildController(presenter, callerUserName: "BillKrat");

        var result = await controller.Get(ClaudeId, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtAction_WithTheNewForm()
    {
        var presenter = new FakeUserPresenter { CreateResult = BuildForm(ClaudeId, "Claude") };
        var controller = BuildController(presenter, callerUserName: "BillKrat");
        var request = new EntityDataModel(string.Empty, new Dictionary<string, string?> { ["UserName"] = "Claude" });

        var result = await controller.Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var form = Assert.IsType<EntityFormModel>(created.Value);
        Assert.Equal("Claude", form.Entity.Values["UserName"]);
        Assert.Same(request, presenter.LastCreateRequest);
    }

    [Fact]
    public async Task Delete_OtherAccount_ReturnsNoContent()
    {
        var presenter = new FakeUserPresenter
        {
            FormByUserName = BuildForm(BillId, "BillKrat"),
            DeleteResult = true,
        };
        var controller = BuildController(presenter, callerUserName: "BillKrat");

        var result = await controller.Delete(ClaudeId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal((ClaudeId, BillId), presenter.LastDeleteCall);
    }

    [Fact]
    public async Task Delete_OwnAccount_ReturnsConflict()
    {
        var presenter = new FakeUserPresenter
        {
            FormByUserName = BuildForm(BillId, "BillKrat"),
            ThrowOnDelete = true,
        };
        var controller = BuildController(presenter, callerUserName: "BillKrat");

        var result = await controller.Delete(BillId, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Delete_ReturnsUnauthorized_WhenCallerCannotBeResolved()
    {
        var presenter = new FakeUserPresenter();
        var controller = BuildController(presenter, callerUserName: null);

        var result = await controller.Delete(ClaudeId, CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result);
    }

    private static UsersController BuildController(FakeUserPresenter presenter, string? callerUserName)
    {
        var identity = callerUserName is null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim(ClaimTypes.Name, callerUserName)], authenticationType: "Test");

        return new UsersController(presenter)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
            },
        };
    }
}
