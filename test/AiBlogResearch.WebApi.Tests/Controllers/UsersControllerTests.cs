// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Security.Claims;
using Adventures.Entities;
using Adventures.Identity;
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
    public async Task List_ReturnsASortedPagedGrid_WithServerBuiltLinks()
    {
        var presenter = new FakeUserPresenter
        {
            Summaries =
            [
                new EntityDataModel(BillId, new Dictionary<string, string?> { ["UserName"] = "BillKrat" }),
                new EntityDataModel(ClaudeId, new Dictionary<string, string?> { ["UserName"] = "Claude" }),
            ],
        };
        var controller = BuildController(presenter, callerUserName: "BillKrat");
        controller.ControllerContext.HttpContext.Request.Path = "/api/users";

        var result = await controller.List(new EntityGridQuery(Page: 2, PageSize: 1, Sort: "UserName", Descending: true), CancellationToken.None);

        var grid = Assert.IsType<EntityGridModel>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(2, grid.Rows.Count);
        Assert.Equal(new EntityGridQuery(2, 1, "UserName", true), presenter.LastQuery);
        Assert.Equal("/api/users?page=2&pageSize=1&sort=UserName&descending=true", grid.Links!.Self);
        Assert.Equal("/api/users", grid.Links.Create);
        Assert.Null(grid.Links.Next);
        Assert.Equal("/api/users?page=1&pageSize=1&sort=UserName&descending=true", grid.Links.Previous);
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

        var created = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(201, created.StatusCode);
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

    private static readonly EntitySchema UserSchemaWithRelation = EntitySchema.Create(
        "urn:test:User",
        [new EntitySchemaField("urn:test:User", "f1", "UserName", "String", "urn:p:name")],
        [new EntityRelationDefinition("TenantRoles", "Tenant roles", "urn:test:Assignment", "urn:p:has")]);

    [Fact]
    public async Task AddRelationChild_Returns201WithTheChild_AndPassesTheRequestToTheWriter()
    {
        var writer = new FakeRelationWriter();
        var controller = BuildController(new FakeUserPresenter(), "BillKrat", writer);
        var request = new EntityDataModel(string.Empty, new Dictionary<string, string?> { ["Role"] = "r1" });

        var result = await controller.AddRelationChild(BillId, "TenantRoles", request, CancellationToken.None);

        Assert.Equal(201, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal((BillId, "TenantRoles", request), writer.LastAdd);
    }

    [Fact]
    public async Task AddRelationChild_IsNotFound_ForAnUnknownRelationOrAMissingParent_AndMapsRuleRefusals()
    {
        var writer = new FakeRelationWriter();
        var controller = BuildController(new FakeUserPresenter(), "BillKrat", writer);
        var request = new EntityDataModel(string.Empty, new Dictionary<string, string?>());

        Assert.IsType<NotFoundResult>(await controller.AddRelationChild(BillId, "NoSuchRelation", request, CancellationToken.None));
        Assert.Null(writer.LastAdd);

        writer.AddResult = null;
        Assert.IsType<NotFoundResult>(await controller.AddRelationChild(BillId, "TenantRoles", request, CancellationToken.None));

        writer.Throw = new Adventures.Common.Exceptions.BusinessRuleException("This entry already exists.");
        Assert.IsType<ConflictObjectResult>(await controller.AddRelationChild(BillId, "TenantRoles", request, CancellationToken.None));

        writer.Throw = new Adventures.Common.Exceptions.InputValidationException(new Dictionary<string, string[]> { ["Role"] = ["Role is required."] });
        Assert.IsType<BadRequestObjectResult>(await controller.AddRelationChild(BillId, "TenantRoles", request, CancellationToken.None));
    }

    [Fact]
    public async Task RemoveRelationChild_Returns204_404_OrConflictForTheLastAdministrator()
    {
        var writer = new FakeRelationWriter();
        var controller = BuildController(new FakeUserPresenter(), "BillKrat", writer);

        Assert.IsType<NoContentResult>(await controller.RemoveRelationChild(BillId, "TenantRoles", "c1", CancellationToken.None));
        Assert.Equal((BillId, "TenantRoles", "c1"), writer.LastRemove);

        writer.RemoveResult = false;
        Assert.IsType<NotFoundResult>(await controller.RemoveRelationChild(BillId, "TenantRoles", "c1", CancellationToken.None));

        writer.Throw = new Adventures.Common.Exceptions.BusinessRuleException("A tenant must keep at least one administrator.");
        Assert.IsType<ConflictObjectResult>(await controller.RemoveRelationChild(BillId, "TenantRoles", "c1", CancellationToken.None));
    }

    private static UsersController BuildController(FakeUserPresenter presenter, string? callerUserName, FakeRelationWriter? writer = null)
    {
        var identity = callerUserName is null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim(ClaimTypes.Name, callerUserName)], authenticationType: "Test");

        return new UsersController(presenter, writer ?? new FakeRelationWriter(), new EntitySchemaOf<User>(UserSchemaWithRelation),
            new FakeProvisioning(), new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<UsersController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
            },
        };
    }

    [Fact]
    public void Controller_IsRestrictedToTheTenantAdminPolicy()
    {
        var authorize = Assert.Single(
            typeof(UsersController).GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), inherit: true)
                .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>());

        Assert.Equal(Adventures.Security.WellKnownClaims.TenantAdminPolicy, authorize.Policy);
    }

    [Fact]
    public void NoActionOverridesTheClassPolicyWithAnAnonymousOrWeakerOne()
    {
        var weakened = typeof(UsersController).GetMethods()
            .Where(m => m.DeclaringType == typeof(UsersController))
            .Where(m => m.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute), true).Length > 0);

        Assert.Empty(weakened);
    }
}

/// <summary>Stands in for the provisioning service: these tests never reach it.</summary>
internal sealed class FakeProvisioning : IUserProvisioning
{
    public Task<ProvisionedLogin> SetInitialPasswordAsync(string tenant, string username, string? email, string? displayName, CancellationToken cancellationToken = default) =>
        Task.FromResult(new ProvisionedLogin(username, "test-only", AccountCreated: false));
}
