using System.Data;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace McpServer.WebApi.BlogAi;

/// <summary>Runs one catalogue query and answers its rows as JSON text.</summary>
public interface IBlogAiReader
{
    /// <summary>False when no connection string is configured, so the tools can say so instead of failing.</summary>
    bool IsConfigured { get; }

    Task<string> RunAsync(BlogAiQuery query, IReadOnlyDictionary<string, string?> arguments, CancellationToken cancellationToken);
}

/// <summary>Thrown for a bad argument; the message is safe to show the caller.</summary>
public sealed class BlogAiArgumentException(string message) : Exception(message);

/// <summary>
/// Reads the legacy BlogEngine.NET SQL Server database with a dedicated SELECT-only login (<c>ConnectionStrings:BlogAi</c>; the
/// password lives in the credential vault and the host's secret store, never in a file). Only <see cref="BlogAiCatalog"/> queries
/// are run, always with parameters, a row cap and a short timeout.
/// </summary>
public sealed partial class BlogAiReader(IConfiguration configuration) : IBlogAiReader
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    [GeneratedRegex("^[A-Za-z0-9_]{1,128}$")]
    private static partial Regex Identifier();

    public bool IsConfigured => !string.IsNullOrWhiteSpace(configuration.GetConnectionString("BlogAi"));

    public async Task<string> RunAsync(BlogAiQuery query, IReadOnlyDictionary<string, string?> arguments, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(configuration.GetConnectionString("BlogAi")
            ?? throw new InvalidOperationException("ConnectionStrings:BlogAi is not configured."));
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = query.Sql;
        command.CommandTimeout = 20;
        foreach (var parameter in query.Parameters)
        {
            command.Parameters.Add(Bind(parameter, arguments.GetValueOrDefault(parameter.Name)));
        }

        var rows = new List<Dictionary<string, object?>>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var row = new Dictionary<string, object?>(reader.FieldCount);
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : Convert(reader.GetValue(i));
            }

            rows.Add(row);
        }

        return JsonSerializer.Serialize(rows, Json);
    }

    private static SqlParameter Bind(BlogAiParameter parameter, string? supplied)
    {
        var text = string.IsNullOrWhiteSpace(supplied) ? null : supplied.Trim();
        if (text is null)
        {
            if (parameter.Required)
            {
                throw new BlogAiArgumentException($"{parameter.Name} is required.");
            }

            return new SqlParameter("@" + parameter.Name, parameter.Default ?? DBNull.Value);
        }

        switch (parameter.Kind)
        {
            case "int":
                if (!int.TryParse(text, out var number))
                {
                    throw new BlogAiArgumentException($"{parameter.Name} must be a whole number.");
                }

                return new SqlParameter("@" + parameter.Name, parameter.Name == "limit" ? Math.Clamp(number, 1, BlogAiCatalog.MaxLimit) : number);
            case "string" when parameter.Name == "table":
                if (!Identifier().IsMatch(text))
                {
                    throw new BlogAiArgumentException("table must be a table name (letters, digits and underscore only).");
                }

                return new SqlParameter("@table", text);
            default:
                if (text.Length > 255)
                {
                    throw new BlogAiArgumentException($"{parameter.Name} is too long.");
                }

                return new SqlParameter("@" + parameter.Name, text);
        }
    }

    private static object Convert(object value) => value switch
    {
        DateTime d => d.ToString("yyyy-MM-ddTHH:mm:ss"),
        Guid g => g.ToString(),
        byte[] b => $"[{b.Length} bytes]",
        _ => value,
    };
}
