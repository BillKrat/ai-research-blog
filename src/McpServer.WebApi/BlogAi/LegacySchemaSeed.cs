using System.Text;

namespace McpServer.WebApi.BlogAi;

/// <summary>
/// Generates the N-Quad seed that gives every legacy table of <see cref="BlogAiTables"/> a schema in the legacy mirror layer:
/// <c>https://schema.global-webnet.com/legacy/&lt;table&gt;</c>, one field per column with its original name, one predicate per column
/// under <c>https://global-webnet.com/ontology/legacy/&lt;table&gt;#&lt;column&gt;</c>, the field order of the table, and the schema version.
/// The output is the file <c>Adventures.Foundation/src/Adventures.Data.NQuad/Sql/seed/seed-009-legacy-schemas.nq</c>; a test keeps the
/// checked-in file identical to this output (set <c>REGENERATE_LEGACY_SEED=1</c> to rewrite it).
/// </summary>
public static class LegacySchemaSeed
{
    public const string SchemaBase = "https://schema.global-webnet.com/legacy/";
    public const string OntologyBase = "https://global-webnet.com/ontology/legacy/";
    public const string SchemaVocabulary = "https://global-webnet.com/ontology/schema#";
    public const string Graph = "https://global-webnet.com/graph/legacy";

    public static string Generate(IEnumerable<BlogAiTable> tables)
    {
        var text = new StringBuilder();
        void Quad(string subject, string predicate, string objectIri) => text.Append('<').Append(subject).Append("> <").Append(predicate).Append("> <").Append(objectIri).Append("> <").Append(Graph).Append("> .\n");
        void Literal(string subject, string predicate, string value) => text.Append('<').Append(subject).Append("> <").Append(predicate).Append("> \"").Append(value).Append("\" <").Append(Graph).Append("> .\n");

        foreach (var table in tables)
        {
            var schema = SchemaBase + table.Name;
            Quad(schema, SchemaVocabulary + "type", SchemaVocabulary + "Schema");
            Literal(schema, SchemaVocabulary + "displayField", DisplayField(table));
            Literal(schema, SchemaVocabulary + "version", BlogAiTables.SchemaVersion);

            for (var order = 0; order < table.Columns.Count; order++)
            {
                var column = table.Columns[order];
                var field = $"{schema}/{column.Name}";
                Quad(schema, SchemaVocabulary + "field", field);
                Literal(field, SchemaVocabulary + "name", column.Name);
                Literal(field, SchemaVocabulary + "fieldType", column.Type);
                Quad(field, SchemaVocabulary + "predicate", $"{OntologyBase}{table.Name}#{column.Name}");
                Literal(field, SchemaVocabulary + "order", order.ToString());
                if (column.Required)
                {
                    Literal(field, SchemaVocabulary + "required", "true");
                }

                // the long text columns stay out of a list view, as in the live content schemas
                if (column.Type == "Text")
                {
                    Literal(field, SchemaVocabulary + "listVisible", "false");
                }
            }
        }

        return text.ToString();
    }

    /// <summary>The first readable String column of the table (a title or a name), else its identity column.</summary>
    private static string DisplayField(BlogAiTable table) =>
        (table.Columns.FirstOrDefault(c => c.Type == "String" && c.Name is "Title" or "BlogName" or "CategoryName" or "UserName" or "Role" or "RightName" or "Tag")
         ?? table.Columns[0]).Name;
}
