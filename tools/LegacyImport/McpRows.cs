// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace LegacyImport;

/// <summary>One legacy row: column name to a typed value (Guid, bool, int, double, DateTimeOffset in UTC, string), null for SQL NULL.</summary>
public sealed class LegacyRowData(Dictionary<string, object?> values) : Dictionary<string, object?>(values);

/// <summary>Where the legacy rows come from; the real source is the MCP blogai_rows tool, tests use an in-memory one.</summary>
public interface ILegacySource
{
    Task<IReadOnlyList<LegacyRowData>> ReadAllAsync(string table, IReadOnlyList<(string Name, string Type)> columns, CancellationToken cancellationToken);
}

/// <summary>
/// Reads the legacy tables through the MCP server's paged <c>blogai_rows</c> tool with the <c>claude-research</c> client (scope
/// <c>blogai.read</c>; the secret comes from the environment, injected by the vault run, and is never printed).
/// </summary>
public sealed class McpRowsSource(HttpClient http, string apiBase, string mcpUrl, string clientSecret) : ILegacySource
{
    private string? _token;
    private int _rpcId;

    public async Task<IReadOnlyList<LegacyRowData>> ReadAllAsync(string table, IReadOnlyList<(string Name, string Type)> columns, CancellationToken cancellationToken)
    {
        var rows = new List<LegacyRowData>();
        const int pageSize = 200;
        for (var offset = 0; ; offset += pageSize)
        {
            var text = await CallAsync("blogai_rows", new { table, offset, limit = pageSize }, cancellationToken);
            using var page = JsonDocument.Parse(text);
            var count = 0;
            foreach (var row in page.RootElement.GetProperty("rows").EnumerateArray())
            {
                rows.Add(Parse(row, columns));
                count++;
            }

            if (count < pageSize)
            {
                return rows;
            }
        }
    }

    internal static LegacyRowData Parse(JsonElement row, IReadOnlyList<(string Name, string Type)> columns)
    {
        var values = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var (name, type) in columns)
        {
            values[name] = row.TryGetProperty(name, out var element) && element.ValueKind != JsonValueKind.Null ? Typed(element, type) : null;
        }

        return new LegacyRowData(values);
    }

    private static object Typed(JsonElement element, string type) => type switch
    {
        "Guid" => Guid.Parse(element.GetString()!),
        "bool" => element.ValueKind == JsonValueKind.True || (element.ValueKind == JsonValueKind.Number && element.GetInt32() != 0),
        "int" => element.GetInt32(),
        "double" => element.GetDouble(),
        // BlogEngine stored server time without a zone; by the human's decision it is read as UTC
        "DateTimeOffset" => new DateTimeOffset(DateTime.SpecifyKind(DateTime.Parse(element.GetString()!, CultureInfo.InvariantCulture, DateTimeStyles.None), DateTimeKind.Utc)),
        _ => element.GetString() ?? string.Empty,
    };

    private async Task<string> CallAsync(string tool, object arguments, CancellationToken cancellationToken)
    {
        _token ??= await GetTokenAsync(cancellationToken);
        var body = JsonSerializer.Serialize(new { jsonrpc = "2.0", id = ++_rpcId, method = "tools/call", @params = new { name = tool, arguments } });
        using var request = new HttpRequestMessage(HttpMethod.Post, mcpUrl) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        using var response = await http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        using var answer = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var result = answer.RootElement.GetProperty("result");
        var text = result.GetProperty("content")[0].GetProperty("text").GetString() ?? string.Empty;
        return result.GetProperty("isError").GetBoolean() ? throw new InvalidOperationException($"{tool} refused: {text}") : text;
    }

    private async Task<string> GetTokenAsync(CancellationToken cancellationToken)
    {
        var body = JsonSerializer.Serialize(new { clientId = "claude-research", clientSecret, scope = "blogai.read" });
        using var response = await http.PostAsync($"{apiBase.TrimEnd('/')}/api/auth/m2m/token", new StringContent(body, Encoding.UTF8, "application/json"), cancellationToken);
        response.EnsureSuccessStatusCode();
        using var token = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return token.RootElement.GetProperty("accessToken").GetString()!;
    }
}
