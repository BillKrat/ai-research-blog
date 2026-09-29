using Adventures.Entities;

namespace AiBlogResearch.WebApi.Presenters;

/// <summary>Implementation of <see cref="IUserPresenter"/> - see that interface for the contract and rationale.</summary>
public sealed class UserPresenter(IUserBll userBll, EntitySchema userSchema) : IUserPresenter
{
    public async Task<EntityFormModel?> GetFormAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await userBll.GetAsync(userId, cancellationToken).ConfigureAwait(false);
        return user is null ? null : EntityFormModel.From(userSchema, user);
    }

    public async Task<EntityFormModel?> GetFormByUserNameAsync(string userName, CancellationToken cancellationToken = default)
    {
        var user = await userBll.FindByUserNameAsync(userName, cancellationToken).ConfigureAwait(false);
        return user is null ? null : EntityFormModel.From(userSchema, user);
    }

    public async Task<IReadOnlyList<UserSummary>> ListAsync(CancellationToken cancellationToken = default)
    {
        var users = await userBll.ListAsync(cancellationToken).ConfigureAwait(false);
        return users
            .Select(user => new UserSummary(
                user.EntityId!.Value,
                user.GetValue("UserName")?.ToString(),
                user.GetValue("DisplayName")?.ToString()))
            .ToArray();
    }

    public async Task<EntityFormModel> CreateAsync(EntityDataModel data, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(data);

        var newId = Guid.NewGuid().ToString();
        var user = new User(userSchema).Set(DynamicEntity.EntityIdPropertyName, newId, newId) as User
            ?? throw new InvalidOperationException("Failed to construct a new User.");
        ApplyValues(user, data);

        var created = await userBll.CreateAsync(user, cancellationToken).ConfigureAwait(false);
        return EntityFormModel.From(userSchema, created);
    }

    public async Task<EntityFormModel?> UpdateAsync(string userId, EntityDataModel data, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(data);

        var existing = await userBll.GetAsync(userId, cancellationToken).ConfigureAwait(false);
        if (existing is null)
        {
            return null;
        }

        ApplyValues(existing, data);
        await userBll.UpdateAsync(existing, cancellationToken).ConfigureAwait(false);
        return EntityFormModel.From(userSchema, existing);
    }

    public Task<bool> DeleteAsync(string userId, string currentUserId, CancellationToken cancellationToken = default) =>
        userBll.DeleteAsync(userId, currentUserId, cancellationToken);

    /// <summary>
    /// Applies every value in <paramref name="data"/> except "Id" - the entity id is derived from
    /// the store subject, never a settable field, same convention NQuadEntityRepository itself
    /// follows. No validation yet (declared scope for this stage) - a blank/missing value for a
    /// field is simply skipped rather than cleared.
    /// </summary>
    private static void ApplyValues(DynamicEntity entity, EntityDataModel data)
    {
        foreach (var (name, value) in data.Values)
        {
            if (name.Equals(DynamicEntity.EntityIdPropertyName, StringComparison.OrdinalIgnoreCase) || value is null)
            {
                continue;
            }

            entity.Set(name, Guid.NewGuid().ToString(), value);
        }
    }
}
