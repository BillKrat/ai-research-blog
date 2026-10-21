using Adventures.Data.NQuad;
using Adventures.Entities;
using McpServer.WebApi.BlogAi;

namespace LegacyImport;

/// <summary>An entity of one legacy mirror schema (one per legacy table; the schema says which).</summary>
public sealed class LegacyRow(EntitySchema schema) : DynamicEntity(schema);

/// <summary>What happened to the rows of one table.</summary>
public sealed record TableResult(string Table, int Read, int Created, int Updated, int Unchanged, int Mismatches, IReadOnlyList<string> Notes);

/// <summary>
/// The legacy mirror layer: every row of a wave table becomes an entity of its <c>legacy/&lt;table&gt;</c> schema, field for field, under a
/// stable id (<see cref="LegacyIds"/>). Running it again changes nothing that is already equal; a changed column supersedes its old
/// value (the store keeps the history). With <c>apply</c> false nothing is written: the same comparison runs and is reported.
/// </summary>
public static class MirrorImporter
{
    public const string BaseIri = "https://global-webnet.com/id/legacy/";
    public const string OntologyBase = "https://global-webnet.com/ontology/legacy/";

    public static NQuadEntityRepository<LegacyRow> Repository(INQuadStore store, EntitySchema schema, string table) =>
        new(store, schema, $"{BaseIri}{table}/", $"{OntologyBase}{table}#Row", EntityConstants.Legacy.DefaultGraph, s => new LegacyRow(s), changedBy: "legacy-import");

    public static async Task<TableResult> ImportAsync(
        BlogAiTable table,
        IReadOnlyList<LegacyRowData> rows,
        EntitySchema schema,
        IEntityRepository<LegacyRow> repository,
        bool apply,
        CancellationToken cancellationToken)
    {
        int created = 0, updated = 0, unchanged = 0, mismatches = 0;
        var notes = new List<string>();
        var seen = new HashSet<Guid>();

        foreach (var row in rows)
        {
            var id = LegacyIds.ForRow(table.Name, row, table.OrderBy);
            if (!seen.Add(id))
            {
                notes.Add($"duplicate id {id} ({table.OrderBy}={row[table.OrderBy]}); second row skipped");
                continue;
            }

            var existing = await repository.GetAsync(id.ToString(), includeDeleted: false, cancellationToken);
            if (existing is null)
            {
                created++;
                if (apply)
                {
                    var entity = new LegacyRow(schema);
                    entity.Set("Id", Guid.NewGuid().ToString(), id);
                    foreach (var column in table.Columns.Where(c => row[c.Name] is not null))
                    {
                        entity.Set(column.Name, Guid.NewGuid().ToString(), row[column.Name]!);
                    }

                    await repository.CreateAsync(entity, cancellationToken);
                }

                continue;
            }

            var differing = table.Columns.Where(c => !Same(existing.GetValue(c.Name), row[c.Name])).ToList();
            if (differing.Count == 0)
            {
                unchanged++;
                continue;
            }

            updated++;
            if (apply)
            {
                foreach (var column in differing)
                {
                    var value = row[column.Name];
                    if (value is null)
                    {
                        existing.Clear(column.Name);
                    }
                    else
                    {
                        existing.Set(column.Name, existing.GetFieldValue(column.Name)?.Id.Value ?? Guid.NewGuid().ToString(), value);
                    }
                }

                await repository.UpdateAsync(existing, cancellationToken);
            }
        }

        if (apply)
        {
            mismatches = await VerifyAsync(table, rows, repository, notes, cancellationToken);
        }

        return new TableResult(table.Name, rows.Count, created, updated, unchanged, mismatches, notes);
    }

    /// <summary>Reads every row back from the store and compares every column with the source: the field-by-field check of the report.</summary>
    private static async Task<int> VerifyAsync(BlogAiTable table, IReadOnlyList<LegacyRowData> rows, IEntityRepository<LegacyRow> repository, List<string> notes, CancellationToken cancellationToken)
    {
        var mismatches = 0;
        foreach (var row in rows)
        {
            var id = LegacyIds.ForRow(table.Name, row, table.OrderBy);
            var stored = await repository.GetAsync(id.ToString(), includeDeleted: false, cancellationToken);
            if (stored is null)
            {
                mismatches++;
                notes.Add($"missing after import: {id}");
                continue;
            }

            foreach (var column in table.Columns.Where(c => !Same(stored.GetValue(c.Name), row[c.Name])))
            {
                mismatches++;
                if (notes.Count < 20)
                {
                    notes.Add($"{id} {column.Name}: source '{Show(row[column.Name])}' stored '{Show(stored.GetValue(column.Name))}'");
                }
            }
        }

        return mismatches;
    }

    internal static bool Same(object? stored, object? source) => (stored, source) switch
    {
        (null, null) => true,
        (null, _) or (_, null) => false,
        (DateTimeOffset a, DateTimeOffset b) => a.UtcDateTime == b.UtcDateTime,
        (double a, double b) => Math.Abs(a - b) < 1e-6,
        _ => Equals(stored, source),
    };

    private static string Show(object? value) => value switch
    {
        null => "(null)",
        string text when text.Length > 40 => text[..40] + "...",
        _ => value.ToString() ?? string.Empty,
    };
}
