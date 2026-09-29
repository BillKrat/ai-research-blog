using Adventures.Common.Interfaces;
using Adventures.Entities;

namespace AiBlogResearch.WebApi.Presenters;

/// <summary>A lightweight row for a user list - not the full schema-driven form.</summary>
public sealed record UserSummary(string Id, string? UserName, string? DisplayName);

/// <summary>
/// Resolved by a controller (scoped, interface-driven, auto-registered the same way
/// <c>MockBll</c>/<c>MockDal</c> are in Adventures.Foundation's MvpVm tests). Orchestrates
/// <see cref="IUserBll"/> plus the cached User <see cref="EntitySchema"/> into the "standard object"
/// (<see cref="EntityFormModel"/>) a UI form control renders from. Kept separate from its
/// implementation (<see cref="UserPresenter"/>) so an alternate/versioned presenter can be swapped
/// in via DI without touching the controllers.
/// </summary>
public interface IUserPresenter : IPresenter
{
    Task<EntityFormModel?> GetFormAsync(string userId, CancellationToken cancellationToken = default);

    Task<EntityFormModel?> GetFormByUserNameAsync(string userName, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserSummary>> ListAsync(CancellationToken cancellationToken = default);

    Task<EntityFormModel> CreateAsync(EntityDataModel data, CancellationToken cancellationToken = default);

    Task<EntityFormModel?> UpdateAsync(string userId, EntityDataModel data, CancellationToken cancellationToken = default);

    /// <summary>Throws <see cref="InvalidOperationException"/> if <paramref name="userId"/> equals <paramref name="currentUserId"/> - see <see cref="IUserBll.DeleteAsync"/>.</summary>
    Task<bool> DeleteAsync(string userId, string currentUserId, CancellationToken cancellationToken = default);
}
