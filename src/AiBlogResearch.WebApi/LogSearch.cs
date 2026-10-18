using Adventures.WebApi;

namespace AiBlogResearch.WebApi;

/// <summary>
/// Finds the log lines of one request in the compact-JSON log files (<c>webapi-*.json.log</c>), newest file first, so an
/// administrator or an MCP tool can read what a request did from its CorrelationId alone. Read-only; the id must be
/// well formed (it is matched as text, never interpreted).
/// </summary>
public static class LogSearch
{
    private const int MaxLineLength = 4_000;

    public static async Task<IReadOnlyList<string>> FindLinesAsync(
        string logDirectory, string correlationId, int max = 200, CancellationToken cancellationToken = default)
    {
        if (!CorrelationIdMiddleware.IsWellFormed(correlationId) || !Directory.Exists(logDirectory))
        {
            return [];
        }

        var needle = $"\"{CorrelationIdMiddleware.LogPropertyName}\":\"{correlationId}\"";
        var found = new List<string>();
        foreach (var file in new DirectoryInfo(logDirectory).GetFiles("webapi-*.json.log").OrderByDescending(f => f.Name))
        {
            // Serilog keeps today's file open for writing, so share it.
            await using var stream = new FileStream(file.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var reader = new StreamReader(stream);
            var inFile = new List<string>();
            while (await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false) is { } line)
            {
                if (line.Contains(needle, StringComparison.Ordinal))
                {
                    inFile.Add(line.Length <= MaxLineLength ? line : line[..MaxLineLength] + "...[truncated]");
                }
            }

            found.InsertRange(0, inFile);
            if (found.Count >= max)
            {
                break;
            }
        }

        return found.Count <= max ? found : found.GetRange(found.Count - max, max);
    }
}
