using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using McpServer.WebApi.BlogAi;
using Microsoft.AspNetCore.Mvc;

namespace McpServer.WebApi.Controllers;

/// <summary>
/// This app's tools over the Model Context Protocol (JSON-RPC 2.0 on one POST endpoint, the "streamable HTTP" transport answering with
/// plain JSON): <c>initialize</c>, <c>tools/list</c> and <c>tools/call</c>, so an MCP client discovers the tools by itself.
/// Two groups, each behind its own scope on the caller token: the read-only diagnostics tools (<c>mcp.diagnostics.read</c>) and the
/// drafts-only authoring tools (<c>content.draft</c>). <c>tools/list</c> shows a caller only the tools its scopes allow, and
/// <c>tools/call</c> checks the scope again for the tool being called. A tool call is a forwarded request to the API with the
/// caller own token; the API stays the single place that decides what is allowed (authoring cannot publish, whatever is asked), and
/// its answer text comes back as the tool result (a refusal or an outage is a tool error, so the model sees the reason).
/// </summary>
[ApiController]
[Route("mcp")]
[Authorize]
public sealed class McpController(DiagnosticsApiClient api, IAuthorizationService authorization, IBlogAiReader blogAi) : ControllerBase
{
    public const string ProtocolVersion = "2025-03-26";
    public const string DiagnosticsScope = DiagnosticsController.RequiredScope;
    public const string AuthoringScope = "content.draft";

    /// <summary>Read-only access to the legacy BlogEngine.NET (BlogAI) database, as the named queries of <see cref="BlogAiCatalog"/>.</summary>
    public const string BlogAiScope = "blogai.read";

    /// <summary>Every tool this server offers, with the scope that unlocks it.</summary>
    public static readonly IReadOnlyList<(string Scope, JsonObject Definition)> Tools =
    [
        (DiagnosticsScope, Tool(
            "diagnose_request",
            "Everything recorded for one request: its exceptions, the kinds of failure they belong to, and its log lines, found by the CorrelationId (the id shown in an error message or the X-Correlation-Id response header).",
            """{ "type": "object", "properties": { "correlationId": { "type": "string", "description": "The request's correlation id." } }, "required": ["correlationId"] }""")),
        (DiagnosticsScope, Tool(
            "recent_exceptions",
            "The most recent active exceptions, newest first.",
            """{ "type": "object", "properties": { "max": { "type": "integer", "description": "How many (1-500, default 50)." } } }""")),
        (DiagnosticsScope, Tool(
            "exception_signatures",
            "Every known kind of failure with how often and when it was seen and its triage status.",
            """{ "type": "object", "properties": {} }""")),
        (AuthoringScope, Tool(
            "list_my_posts",
            "The posts the authoring account has written (id, title, slug, whether published, categories, tags), newest first.",
            """{ "type": "object", "properties": {} }""")),
        (AuthoringScope, Tool(
            "create_draft_post",
            "Creates a blog post as a DRAFT under the authoring account. It can never publish: an administrator reviews and publishes in the admin. Content is Markdown. Categories and tags are given by name and are created when they do not exist.",
            """
            { "type": "object",
              "properties": {
                "title": { "type": "string" },
                "content": { "type": "string", "description": "The post body in Markdown." },
                "description": { "type": "string", "description": "One-sentence summary." },
                "slug": { "type": "string", "description": "Optional URL slug; made from the title when omitted." },
                "categories": { "type": "array", "items": { "type": "string" }, "description": "For example Help, Development log, MCP." },
                "tags": { "type": "array", "items": { "type": "string" }, "description": "By feature, for example Pages, Posts, Roles, MCP." },
                "enableComments": { "type": "boolean" } },
              "required": ["title"] }
            """)),
        (AuthoringScope, Tool(
            "update_draft_post",
            "Revises one of the authoring account's own posts while it is still a draft; only the fields given change. A published post, or someone else's, is refused.",
            """
            { "type": "object",
              "properties": {
                "id": { "type": "string", "description": "The post id from list_my_posts or create_draft_post." },
                "title": { "type": "string" }, "content": { "type": "string" }, "description": { "type": "string" }, "slug": { "type": "string" },
                "categories": { "type": "array", "items": { "type": "string" } }, "tags": { "type": "array", "items": { "type": "string" } },
                "enableComments": { "type": "boolean" } },
              "required": ["id", "title"] }
            """)),
        (AuthoringScope, Tool(
            "propose_revision",
            "Proposes changes to one of the authoring account's own PUBLISHED posts without changing what readers see: it creates a hidden draft copy carrying the changes, marked as a revision of the post (asking again updates the same revision). An administrator applies or discards it in the admin. Name only what changes; everything else carries over from the published post, and the published address never changes.",
            """
            { "type": "object",
              "properties": {
                "id": { "type": "string", "description": "The published post id from list_my_posts." },
                "title": { "type": "string" }, "content": { "type": "string", "description": "The new Markdown body." }, "description": { "type": "string" },
                "categories": { "type": "array", "items": { "type": "string" } }, "tags": { "type": "array", "items": { "type": "string" } },
                "enableComments": { "type": "boolean" } },
              "required": ["id"] }
            """)),
        (AuthoringScope, Tool("list_categories", "Every category (id and name).", """{ "type": "object", "properties": {} }""")),
        (AuthoringScope, Tool("list_tags", "Every tag (id and name).", """{ "type": "object", "properties": {} }""")),
        (AuthoringScope, Tool(
            "create_category",
            "Finds the category with this name (any case) or creates it.",
            """{ "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] }""")),
        (AuthoringScope, Tool(
            "create_tag",
            "Finds the tag with this name (any case) or creates it.",
            """{ "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] }""")),
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

    private static JsonObject Tool(string name, string description, string inputSchema) =>
        new() { ["name"] = name, ["description"] = description, ["inputSchema"] = JsonNode.Parse(inputSchema) };

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        // At least one of the two scopes is needed to use this endpoint at all; each tool then needs its own.
        var scopes = await GrantedScopesAsync();
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
                return Ok(Result(id, new JsonObject
                {
                    ["tools"] = new JsonArray(Tools.Where(t => scopes.Contains(t.Scope)).Select(t => JsonNode.Parse(t.Definition.ToJsonString())).ToArray()),
                }));
            case "tools/call":
                return Ok(await CallToolAsync(id, body, scopes, cancellationToken));
            default:
                return Ok(Error(id, -32601, $"Method not found: {method}"));
        }
    }

    /// <summary>Which of this server scopes the caller token holds (checked through the same scope policies the REST routes use).</summary>
    private async Task<HashSet<string>> GrantedScopesAsync()
    {
        var granted = new HashSet<string>(StringComparer.Ordinal);
        foreach (var scope in new[] { DiagnosticsScope, AuthoringScope, BlogAiScope })
        {
            if ((await authorization.AuthorizeAsync(User, null, "Scope:" + scope)).Succeeded)
            {
                granted.Add(scope);
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

        var tool = Tools.FirstOrDefault(t => t.Definition["name"]!.GetValue<string>() == name);
        if (tool.Definition is null)
        {
            return Error(id, -32602, $"Unknown tool: {name}");
        }

        if (!scopes.Contains(tool.Scope))
        {
            return ToolResult(id, $"This token does not carry the '{tool.Scope}' scope that '{name}' needs.", isError: true);
        }

        var arguments = parameters.TryGetProperty("arguments", out var a) && a.ValueKind == JsonValueKind.Object ? a : default;
        string? Text(string key) => arguments.ValueKind == JsonValueKind.Object && arguments.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        JsonNode? Args() => arguments.ValueKind == JsonValueKind.Object ? JsonNode.Parse(arguments.GetRawText()) : new JsonObject();

        if (name == RowsToolName)
        {
            return await CallBlogAiRowsAsync(id, arguments, cancellationToken);
        }

        if (BlogAiCatalog.Find(name) is { } blogAiQuery)
        {
            return await CallBlogAiAsync(id, blogAiQuery, arguments, cancellationToken);
        }

        HttpMethod method;
        string path;
        JsonNode? payload = null;
        switch (name)
        {
            case "diagnose_request":
                if (string.IsNullOrWhiteSpace(Text("correlationId")))
                {
                    return ToolResult(id, "correlationId is required.", isError: true);
                }

                (method, path) = (HttpMethod.Get, $"api/diagnostics/{Uri.EscapeDataString(Text("correlationId")!)}");
                break;
            case "recent_exceptions":
                var max = arguments.ValueKind == JsonValueKind.Object && arguments.TryGetProperty("max", out var m) && m.TryGetInt32(out var number) ? number : 50;
                (method, path) = (HttpMethod.Get, $"api/diagnostics/recent?max={max}");
                break;
            case "exception_signatures":
                (method, path) = (HttpMethod.Get, "api/diagnostics/signatures");
                break;
            case "list_my_posts":
                (method, path) = (HttpMethod.Get, "api/author/posts");
                break;
            case "create_draft_post":
                if (string.IsNullOrWhiteSpace(Text("title")))
                {
                    return ToolResult(id, "title is required.", isError: true);
                }

                (method, path, payload) = (HttpMethod.Post, "api/author/posts", Args());
                break;
            case "update_draft_post":
                if (string.IsNullOrWhiteSpace(Text("id")) || string.IsNullOrWhiteSpace(Text("title")))
                {
                    return ToolResult(id, "id and title are required.", isError: true);
                }

                var update = Args()!.AsObject();
                update.Remove("id");
                (method, path, payload) = (HttpMethod.Put, $"api/author/posts/{Uri.EscapeDataString(Text("id")!)}", update);
                break;
            case "propose_revision":
                if (string.IsNullOrWhiteSpace(Text("id")))
                {
                    return ToolResult(id, "id is required.", isError: true);
                }

                var revision = Args()!.AsObject();
                revision.Remove("id");
                (method, path, payload) = (HttpMethod.Post, $"api/author/posts/{Uri.EscapeDataString(Text("id")!)}/revision", revision);
                break;
            case "list_categories":
                (method, path) = (HttpMethod.Get, "api/author/categories");
                break;
            case "list_tags":
                (method, path) = (HttpMethod.Get, "api/author/tags");
                break;
            case "create_category":
            case "create_tag":
                if (string.IsNullOrWhiteSpace(Text("name")))
                {
                    return ToolResult(id, "name is required.", isError: true);
                }

                (method, path, payload) = (HttpMethod.Post, name == "create_tag" ? "api/author/tags" : "api/author/categories", Args());
                break;
            default:
                return Error(id, -32602, $"Unknown tool: {name}");
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
