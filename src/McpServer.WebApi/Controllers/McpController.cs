// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using McpServer.WebApi.BlogAi;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace McpServer.WebApi.Controllers;

/// <summary>
/// This app's tools over the Model Context Protocol (JSON-RPC 2.0 on one POST endpoint, the "streamable HTTP" transport answering with
/// plain JSON): <c>initialize</c>, <c>tools/list</c> and <c>tools/call</c>, so an MCP client discovers the tools by itself.
/// The tools come from two places. The API's own tools (diagnostics, authoring, collaboration, and any a plug-in adds) are read from the
/// API's manifest (<c>GET api/tools</c>, filtered by the caller token's scopes and the enabled plug-ins), so a new tool needs no change
/// here; a call is a request built from the manifest's route and sent to the API with the caller own token, and the API stays the single
/// place that decides what is allowed (authoring cannot publish, whatever is asked). Its answer text comes back as the tool result (a
/// refusal or an outage is a tool error, so the model sees the reason). The research tools (<c>blogai.read</c>) are this server's own:
/// they read the legacy store directly.
/// </summary>
[ApiController]
[Route("mcp")]
[Authorize]
public sealed class McpController(DiagnosticsApiClient api, IAuthorizationService authorization, IBlogAiReader blogAi, IMemoryCache cache) : ControllerBase
{
    /// <summary>How long one token's tool list is remembered. Short, so an enabled or disabled plug-in shows up within a minute.</summary>
    public static readonly TimeSpan ManifestLifetime = TimeSpan.FromSeconds(60);

    public const string ProtocolVersion = "2025-03-26";
    public const string DiagnosticsScope = DiagnosticsController.RequiredScope;
    public const string AuthoringScope = "content.draft";

    /// <summary>Read-only access to the legacy BlogEngine.NET (BlogAI) database, as the named queries of <see cref="BlogAiCatalog"/>.</summary>
    public const string BlogAiScope = "blogai.read";

    /// <summary>The research-only tools this server owns (they read the legacy store directly, so they exist only here), with the scope that unlocks each. Every other tool comes from the API's manifest.</summary>
    public static readonly IReadOnlyList<(string Scope, JsonObject Definition)> ResearchTools =
    [
        .. BlogAiCatalog.Queries.Select(q => (BlogAiScope, BlogAiTool(q))),
        (BlogAiScope, new JsonObject
        {
            ["name"] = RowsToolName,
            ["description"] = "One page of rows of a legacy table, every column except secrets, ordered by the table's identity column. For the schema-faithful migration. Only the wave tables are readable (see the table enum). Read-only.",
            ["inputSchema"] = new JsonObject
            {
                ["type"] = "object",
                ["properties"] = new JsonObject
                {
                    ["table"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray(BlogAiTables.All.Select(t => (JsonNode)t.Name).ToArray()), ["description"] = "The legacy table." },
                    ["offset"] = new JsonObject { ["type"] = "integer", ["description"] = "Rows to skip (default 0)." },
                    ["limit"] = new JsonObject { ["type"] = "integer", ["description"] = $"Rows per page (1-{BlogAiTables.MaxPageSize}, default {BlogAiTables.DefaultPageSize})." },
                },
                ["required"] = new JsonArray("table"),
            },
        }),
    ];

    public const string RowsToolName = "blogai_rows";

    private static JsonObject BlogAiTool(BlogAiQuery query)
    {
        var properties = new JsonObject();
        foreach (var parameter in query.Parameters)
        {
            properties[parameter.Name] = new JsonObject
            {
                ["type"] = parameter.Kind == "int" ? "integer" : "string",
                ["description"] = parameter.Description,
            };
        }

        return new JsonObject
        {
            ["name"] = query.Name,
            ["description"] = query.Description + " Read-only.",
            ["inputSchema"] = new JsonObject
            {
                ["type"] = "object",
                ["properties"] = properties,
                ["required"] = new JsonArray(query.Parameters.Where(p => p.Required).Select(p => (JsonNode)p.Name).ToArray()),
            },
        };
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        // At least one of the two scopes is needed to use this endpoint at all; each tool then needs its own.
        var scopes = await GrantedScopesAsync(cancellationToken);
        if (scopes.Count == 0)
        {
            return Forbid();
        }

        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("method", out var methodElement) || methodElement.GetString() is not { } method)
        {
            return Ok(Error(null, -32600, "Invalid request."));
        }

        var hasId = body.TryGetProperty("id", out var idElement);
        JsonNode? id = hasId ? JsonNode.Parse(idElement.GetRawText()) : null;

        if (!hasId)
        {
            // a notification (for example notifications/initialized): nothing to answer
            return Accepted();
        }

        switch (method)
        {
            case "initialize":
                return Ok(Result(id, new JsonObject
                {
                    ["protocolVersion"] = ProtocolVersion,
                    ["capabilities"] = new JsonObject { ["tools"] = new JsonObject { ["listChanged"] = false } },
                    ["serverInfo"] = new JsonObject { ["name"] = "adventures-mcp", ["version"] = "1.1.0" },
                    ["instructions"] = "Diagnostics (read-only): start with recent_exceptions or exception_signatures, then diagnose_request with a correlation id. Authoring (drafts only): create_draft_post and update_draft_post write Markdown drafts that an administrator publishes.",
                }));
            case "ping":
                return Ok(Result(id, new JsonObject()));
            case "tools/list":
                var listed = new JsonArray();
                foreach (var tool in (await ManifestAsync(cancellationToken)).Tools)
                {
                    listed.Add(tool.ToDefinition());
                }

                foreach (var research in ResearchTools.Where(t => scopes.Contains(t.Scope)))
                {
                    listed.Add(JsonNode.Parse(research.Definition.ToJsonString()));
                }

                return Ok(Result(id, new JsonObject { ["tools"] = listed }));
            case "tools/call":
                return Ok(await CallToolAsync(id, body, scopes, cancellationToken));
            default:
                return Ok(Error(id, -32601, $"Method not found: {method}"));
        }
    }

    /// <summary>Which of this server scopes the caller token holds (checked through the same scope policies the REST routes use).</summary>
    private async Task<HashSet<string>> GrantedScopesAsync(CancellationToken cancellationToken)
    {
        var granted = new HashSet<string>(StringComparer.Ordinal);
        foreach (var scope in new[] { DiagnosticsScope, AuthoringScope, BlogAiScope })
        {
            if ((await authorization.AuthorizeAsync(User, null, "Scope:" + scope)).Succeeded)
            {
                granted.Add(scope);
            }
        }

        if (granted.Count == 0)
        {
            // A plug-in tool may carry a scope this server has never heard of. The API already filtered its manifest by the token, so a scope
            // that both the token and a listed tool carry is a real grant: no code change here when a plug-in brings a new scope.
            var held = User.FindAll("scope")
                .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                .ToHashSet(StringComparer.Ordinal);
            foreach (var tool in (await ManifestAsync(cancellationToken)).Tools.Where(t => held.Contains(t.RequiredScope)))
            {
                granted.Add(tool.RequiredScope);
            }
        }

        return granted;
    }

    private async Task<JsonObject> CallToolAsync(JsonNode? id, JsonElement body, HashSet<string> scopes, CancellationToken cancellationToken)
    {
        if (!body.TryGetProperty("params", out var parameters) || !parameters.TryGetProperty("name", out var nameElement) || nameElement.GetString() is not { } name)
        {
            return Error(id, -32602, "tools/call needs params.name.");
        }

        var research = ResearchTools.FirstOrDefault(t => t.Definition["name"]!.GetValue<string>() == name);
        if (research.Definition is not null && !scopes.Contains(research.Scope))
        {
            return ToolResult(id, $"This token does not carry the '{research.Scope}' scope that '{name}' needs.", isError: true);
        }

        var arguments = parameters.TryGetProperty("arguments", out var a) && a.ValueKind == JsonValueKind.Object ? a : default;
        string? Text(string key) => arguments.ValueKind == JsonValueKind.Object && arguments.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        if (name == RowsToolName)
        {
            return await CallBlogAiRowsAsync(id, arguments, cancellationToken);
        }

        if (BlogAiCatalog.Find(name) is { } blogAiQuery)
        {
            return await CallBlogAiAsync(id, blogAiQuery, arguments, cancellationToken);
        }

        // Every other tool is described by the API's manifest (its route, method and input schema): build the request from that.
        var manifest = await ManifestAsync(cancellationToken);
        if (manifest.Problem is not null)
        {
            return ToolResult(id, manifest.Problem, isError: true);
        }

        var tool = manifest.Tools.FirstOrDefault(t => t.Name == name);
        if (tool is null)
        {
            return Error(id, -32602, $"Unknown tool: {name}");
        }

        var args = arguments.ValueKind == JsonValueKind.Object ? JsonNode.Parse(arguments.GetRawText())!.AsObject() : new JsonObject();
        var missing = tool.Required.Where(key => string.IsNullOrWhiteSpace(args[key]?.ToString())).ToList();
        if (missing.Count > 0)
        {
            return ToolResult(id, $"{string.Join(" and ", missing)} {(missing.Count == 1 ? "is" : "are")} required.", isError: true);
        }

        var path = System.Text.RegularExpressions.Regex.Replace(tool.Path, @"\{(\w+)\}", match =>
        {
            var value = args[match.Groups[1].Value]?.ToString() ?? string.Empty;
            args.Remove(match.Groups[1].Value);
            return Uri.EscapeDataString(value);
        });
        var method = new HttpMethod(tool.Method);
        JsonNode? payload = null;
        if (method == HttpMethod.Get)
        {
            if (args.Count > 0)
            {
                path += "?" + string.Join("&", args.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value?.ToString() ?? string.Empty)}"));
            }
        }
        else
        {
            payload = args;
        }

        var answer = await api.SendAsync(method, path, payload, Request.Headers.Authorization.ToString(), cancellationToken);
        if (answer.Unreachable)
        {
            return ToolResult(id, "The API could not be reached.", isError: true);
        }

        return answer.StatusCode is >= 200 and < 300
            ? ToolResult(id, answer.Body, isError: false)
            : ToolResult(id, $"The API answered HTTP {answer.StatusCode}. {answer.Body}".Trim(), isError: true);
    }

    /// <summary>One tool as the API's manifest (GET api/tools) describes it.</summary>
    private sealed record ApiTool(string Name, string Description, JsonNode InputSchema, string RequiredScope, string Method, string Path, IReadOnlyList<string> Required)
    {
        public JsonObject ToDefinition() => new() { ["name"] = Name, ["description"] = Description, ["inputSchema"] = InputSchema.DeepClone() };
    }

    private sealed record Manifest(IReadOnlyList<ApiTool> Tools, string? Problem);

    /// <summary>
    /// Asks the API which tools this caller token may use (the API filters by the token's scopes and by the enabled plug-ins, so this list never
    /// advertises what the API would refuse). An unreachable or refusing API gives an empty list and the reason, so the research tools still work.
    /// </summary>
    private async Task<Manifest> ManifestAsync(CancellationToken cancellationToken)
    {
        // Remembered per token for a minute: a tool call no longer asks the API for the list first. Only a good answer is kept.
        var key = "mcp-manifest:" + Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(Request.Headers.Authorization.ToString())));
        if (cache.TryGetValue(key, out Manifest? remembered) && remembered is not null)
        {
            return remembered;
        }

        var fresh = await FetchManifestAsync(cancellationToken);
        if (fresh.Problem is null)
        {
            cache.Set(key, fresh, ManifestLifetime);
        }

        return fresh;
    }

    private async Task<Manifest> FetchManifestAsync(CancellationToken cancellationToken)
    {
        var answer = await api.GetAsync("api/tools", Request.Headers.Authorization.ToString(), cancellationToken);
        if (answer.Unreachable)
        {
            return new Manifest([], "The API could not be reached.");
        }

        if (answer.StatusCode is < 200 or >= 300)
        {
            return new Manifest([], $"The API refused the tool list (HTTP {answer.StatusCode}).");
        }

        try
        {
            using var document = JsonDocument.Parse(answer.Body);
            var tools = new List<ApiTool>();
            foreach (var item in document.RootElement.EnumerateArray())
            {
                var schema = JsonNode.Parse(item.GetProperty("inputSchema").GetRawText())!;
                var required = schema["required"] is JsonArray list ? list.Select(r => r!.GetValue<string>()).ToList() : [];
                tools.Add(new ApiTool(
                    item.GetProperty("name").GetString()!,
                    item.GetProperty("description").GetString() ?? string.Empty,
                    schema,
                    item.GetProperty("requiredScope").GetString() ?? string.Empty,
                    item.GetProperty("method").GetString()!,
                    item.GetProperty("path").GetString()!,
                    required));
            }

            return new Manifest(tools, null);
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return new Manifest([], "The API's tool list could not be read.");
        }
    }

    /// <summary>One page of one allowlisted legacy table. An unknown table, or a bad number, is reported as such.</summary>
    private async Task<JsonObject> CallBlogAiRowsAsync(JsonNode? id, JsonElement arguments, CancellationToken cancellationToken)
    {
        if (!blogAi.IsConfigured)
        {
            return ToolResult(id, "The legacy database is not configured on this server (ConnectionStrings:BlogAi).", isError: true);
        }

        string? Text(string key) => arguments.ValueKind == JsonValueKind.Object && arguments.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        int Number(string key, int fallback) => arguments.ValueKind == JsonValueKind.Object && arguments.TryGetProperty(key, out var v) && v.TryGetInt32(out var n) ? n : fallback;

        if (BlogAiTables.Find(Text("table") ?? string.Empty) is not { } table)
        {
            return ToolResult(id, $"table must be one of: {string.Join(", ", BlogAiTables.All.Select(t => t.Name))}.", isError: true);
        }

        try
        {
            return ToolResult(id, await blogAi.ReadRowsAsync(table, Number("offset", 0), Number("limit", BlogAiTables.DefaultPageSize), cancellationToken), isError: false);
        }
        catch (Microsoft.Data.SqlClient.SqlException e)
        {
            return ToolResult(id, $"The legacy database refused the query (SQL error {e.Number}); the read-only login may be missing a grant on {table.Name}.", isError: true);
        }
    }

    /// <summary>Runs one legacy-data query. A bad argument is reported as such; anything else is logged by the exception handler and answered without detail.</summary>
    private async Task<JsonObject> CallBlogAiAsync(JsonNode? id, BlogAiQuery query, JsonElement arguments, CancellationToken cancellationToken)
    {
        if (!blogAi.IsConfigured)
        {
            return ToolResult(id, "The legacy database is not configured on this server (ConnectionStrings:BlogAi).", isError: true);
        }

        var supplied = new Dictionary<string, string?>(StringComparer.Ordinal);
        if (arguments.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in arguments.EnumerateObject())
            {
                supplied[property.Name] = property.Value.ValueKind == JsonValueKind.String ? property.Value.GetString() : property.Value.GetRawText();
            }
        }

        try
        {
            return ToolResult(id, await blogAi.RunAsync(query, supplied, cancellationToken), isError: false);
        }
        catch (BlogAiArgumentException e)
        {
            return ToolResult(id, e.Message, isError: true);
        }
        catch (Microsoft.Data.SqlClient.SqlException e)
        {
            return ToolResult(id, $"The legacy database refused the query (SQL error {e.Number}).", isError: true);
        }
    }

    private static JsonObject ToolResult(JsonNode? id, string text, bool isError) =>
        Result(id, new JsonObject
        {
            ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }),
            ["isError"] = isError,
        });

    private static JsonObject Result(JsonNode? id, JsonNode result) =>
        new() { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = result };

    private static JsonObject Error(JsonNode? id, int code, string message) =>
        new() { ["jsonrpc"] = "2.0", ["id"] = id, ["error"] = new JsonObject { ["code"] = code, ["message"] = message } };
}
