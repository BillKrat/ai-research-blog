namespace AiBlogResearch.Data;

/// <summary>
/// Generic CRUDL access to <see cref="Entity"/> records, backed by the "standard fields" JSONB
/// side of the JSONB Hybrid + N-Quads storage model. See <see cref="ITripleStore"/> for the
/// companion interface covering fully user-defined/extension fields.
/// </summary>
public interface IEntityRepository
{
    /// <summary>Inserts a new entity and returns the stored record (with server-assigned timestamps/row version).</summary>
    Task<Entity> CreateAsync(Entity entity, CancellationToken cancellationToken = default);

    /// <summary>Retrieves a single entity by id, or <c>null</c> if it does not exist.</summary>
    Task<Entity?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Updates an existing entity's standard fields. Returns <c>false</c> if no entity with that id exists.</summary>
    Task<bool> UpdateAsync(Entity entity, CancellationToken cancellationToken = default);

    /// <summary>Deletes an entity by id. Returns <c>false</c> if no entity with that id existed.</summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Lists entities matching the given filter criteria.</summary>
    Task<IReadOnlyList<Entity>> ListAsync(EntityQuery query, CancellationToken cancellationToken = default);
}
