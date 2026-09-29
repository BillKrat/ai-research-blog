using Adventures.Entities;
using AiBlogResearch.WebApi.Presenters;

namespace AiBlogResearch.WebApi.Tests.Controllers;

/// <summary>Shared test double for <see cref="IUserPresenter"/>, used by both ProfileControllerTests and UsersControllerTests.</summary>
internal sealed class FakeUserPresenter : IUserPresenter
{
    public EntityFormModel? FormByUserName { get; set; }

    public EntityFormModel? FormById { get; set; }

    public IReadOnlyList<UserSummary> Summaries { get; set; } = [];

    public EntityFormModel? CreateResult { get; set; }

    public EntityFormModel? UpdateResult { get; set; }

    public bool ThrowOnDelete { get; set; }

    public bool DeleteResult { get; set; } = true;

    public EntityDataModel? LastCreateRequest { get; private set; }

    public EntityDataModel? LastUpdateRequest { get; private set; }

    public (string UserId, string CurrentUserId)? LastDeleteCall { get; private set; }

    public Task<EntityFormModel?> GetFormAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(FormById);

    public Task<EntityFormModel?> GetFormByUserNameAsync(string userName, CancellationToken cancellationToken = default) =>
        Task.FromResult(FormByUserName);

    public Task<IReadOnlyList<UserSummary>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(Summaries);

    public Task<EntityFormModel> CreateAsync(EntityDataModel data, CancellationToken cancellationToken = default)
    {
        LastCreateRequest = data;
        return Task.FromResult(CreateResult ?? throw new InvalidOperationException("CreateResult was not set."));
    }

    public Task<EntityFormModel?> UpdateAsync(string userId, EntityDataModel data, CancellationToken cancellationToken = default)
    {
        LastUpdateRequest = data;
        return Task.FromResult(UpdateResult);
    }

    public Task<bool> DeleteAsync(string userId, string currentUserId, CancellationToken cancellationToken = default)
    {
        LastDeleteCall = (userId, currentUserId);
        if (ThrowOnDelete)
        {
            throw new InvalidOperationException("You cannot delete your own account.");
        }

        return Task.FromResult(DeleteResult);
    }
}
