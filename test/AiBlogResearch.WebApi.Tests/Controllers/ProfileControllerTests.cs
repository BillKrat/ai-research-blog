using System.Security.Claims;
using Adventures.Data;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public class ProfileControllerTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private const string SeedStandardFieldsJson =
        """{"username":"BillKrat","email":"bill@adventuresontheedge.net","display_name":"Bill Kratochvil","status":"active","roles":["TenantAdmin","Author"]}""";

    [Fact]
    public async Task Me_ReturnsFieldsFromStandardFieldsJson_WhenCallerIsAuthenticated()
    {
        var repository = new FakeEntityRepository(BuildUserEntity(SeedStandardFieldsJson));
        var controller = BuildController(repository, UserId);

        var result = await controller.Me(CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProfileResponse>(okResult.Value);
        Assert.Equal("BillKrat", Field(response, "username").Value);
        Assert.True(Field(response, "username").IsReadOnly);
        Assert.Equal("bill@adventuresontheedge.net", Field(response, "email").Value);
        Assert.False(Field(response, "email").IsReadOnly);
        Assert.Equal("Bill Kratochvil", Field(response, "display_name").Value);
        Assert.Equal("active", Field(response, "status").Value);
        Assert.Equal("TenantAdmin, Author", Field(response, "roles").Value);
    }

    [Fact]
    public async Task Me_ReturnsUnauthorized_WhenNoSubClaimIsPresent()
    {
        var repository = new FakeEntityRepository(BuildUserEntity(SeedStandardFieldsJson));
        var controller = BuildController(repository, userId: null);

        var result = await controller.Me(CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task Me_ReturnsNotFound_WhenEntityIsMissingOrNotAUser()
    {
        var repository = new FakeEntityRepository(entity: null);
        var controller = BuildController(repository, UserId);

        var result = await controller.Me(CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task UpdateMe_SavesEmailAndDisplayName_KeepingUsernameStatusAndRoles()
    {
        var repository = new FakeEntityRepository(BuildUserEntity(SeedStandardFieldsJson));
        var controller = BuildController(repository, UserId);

        var result = await controller.UpdateMe(new UpdateProfileRequest("new@example.com", "New Name"), CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ProfileResponse>(okResult.Value);
        Assert.Equal("new@example.com", Field(response, "email").Value);
        Assert.Equal("New Name", Field(response, "display_name").Value);
        Assert.Equal("BillKrat", Field(response, "username").Value);
        Assert.Equal("TenantAdmin, Author", Field(response, "roles").Value);
        Assert.Contains("new@example.com", repository.LastSavedEntity?.StandardFieldsJson);
    }

    [Fact]
    public async Task UpdateMe_ReturnsConflict_WhenRepositoryUpdateFails()
    {
        var repository = new FakeEntityRepository(BuildUserEntity(SeedStandardFieldsJson)) { UpdateSucceeds = false };
        var controller = BuildController(repository, UserId);

        var result = await controller.UpdateMe(new UpdateProfileRequest("new@example.com", "New Name"), CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    private static ProfileField Field(ProfileResponse response, string id) =>
        response.Fields.Single(field => field.Id == id);

    private static Entity BuildUserEntity(string standardFieldsJson) => new(
        UserId,
        Tenant: "global-webnet.com",
        Org: "default",
        EntityType: "user",
        StandardFieldsJson: standardFieldsJson,
        CreatedAt: DateTimeOffset.UtcNow,
        UpdatedAt: DateTimeOffset.UtcNow,
        RowVersion: 1);

    private static ProfileController BuildController(FakeEntityRepository repository, Guid? userId)
    {
        var identity = userId is null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim("sub", userId.Value.ToString())], authenticationType: "Test");

        return new ProfileController(repository)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
            },
        };
    }

    private sealed class FakeEntityRepository(Entity? entity) : IEntityRepository
    {
        public bool UpdateSucceeds { get; set; } = true;

        public Entity? LastSavedEntity { get; private set; }

        public Task<Entity> CreateAsync(Entity entity, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Entity?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(entity is not null && entity.Id == id ? entity : null);

        public Task<bool> UpdateAsync(Entity entity, CancellationToken cancellationToken = default)
        {
            if (!UpdateSucceeds)
            {
                return Task.FromResult(false);
            }

            LastSavedEntity = entity;
            this.entity = entity;
            return Task.FromResult(true);
        }

        public Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<Entity>> ListAsync(EntityQuery query, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Entity?> FindByStandardFieldAsync(string tenant, string entityType, string fieldName, string fieldValue, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        private Entity? entity = entity;
    }
}
