using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace McpServer.WebApi.Controllers;

/// <summary>
/// The diagnostics tool over the Model Context Protocol (JSON-RPC 2.0 on one POST endpoint, the "streamable HTTP" transport
/// answering with plain JSON): <c>initialize</c>, <c>tools/list</c> and <c>tools/call</c>, so an MCP client discovers the tools
/// by itself instead of being told the REST routes. Same scope as the REST controller (<c>mcp.diagnostics.read</c>), same
/// read-only questions, same forwarding: a tool call is a GET to the API with the caller's own token, and the API's answer
/// text is returned as the tool result (an API refusal or outage is a tool error, so the model sees the reason).
/// </summary>
[ApiController]
[Route("mcp")]
[Authorize(Policy = "Scope:" + DiagnosticsController.RequiredScope)]
public sealed class McpController(DiagnosticsApiClient api) : ControllerBase
{
    public const string ProtocolVersion = "2025-03-26";

    public static readonly JsonArray Tools = JsonNode.Parse("""
        [
          {
            "name": "diagnose_request",
            "description": "Everything recorded for one request: its exceptions, the kinds of failure they belong to, and its log lines, found by the CorrelationId (the id shown in an error message or the X-Correlation-Id response header).",
            "inputSchema": { "type": "object", "properties": { "correlationId": { "type": "string", "description": "The request's correlation id." } }, "required": ["correlationId"] }
          },
          {
            "name": "recent_exceptions",
            "description": "The most recent active exceptions, newest first.",
            "inputSchema": { "type": "object", "properties": { "max": { "type": "integer", "description": "How many (1-500, default 50)." } } }
          },
          {
            "name": "exception_signatures",
            "description": "Every known kind of failure with how often and when it was seen and its triage status.",
            "inputSchema": { "type": "object", "properties": {} }
          }
        ]
        """)!.AsArray();

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
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
                    ["serverInfo"] = new JsonObject { ["name"] = "adventures-diagnostics", ["version"] = "1.0.0" },
                    ["instructions"] = "Read-only eyes into the running system. Start with recent_exceptions or exception_signatures, then diagnose_request with a correlation id.",
                }));
            case "ping":
                return Ok(Result(id, new JsonObject()));
            case "tools/list":
                return Ok(Result(id, new JsonObject { ["tools"] = JsonNode.Parse(Tools.ToJsonString()) }));
            case "tools/call":
                return Ok(await CallToolAsync(id, body, cancellationToken));
            default:
                return Ok(Error(id, -32601, $"Method not found: {method}"));
        }
    }

    private async Task<JsonObject> CallToolAsync(JsonNode? id, JsonElement body, CancellationToken cancellationToken)
    {
        if (!body.TryGetProperty("params", out var parameters) || !parameters.TryGetProperty("name", out var nameElement) || nameElement.GetString() is not { } name)
        {
            return Error(id, -32602, "tools/call needs params.name.");
        }

        JsonElement arguments = default;
        var hasArguments = parameters.TryGetProperty("arguments", out arguments) && arguments.ValueKind == JsonValueKind.Object;

        string path;
        switch (name)
        {
            case "diagnose_request":
                var correlationId = hasArguments && arguments.TryGetProperty("correlationId", out var c) ? c.GetString() : null;
                if (string.IsNullOrWhiteSpace(correlationId))
                {
                    return ToolResult(id, "correlationId is required.", isError: true);
                }

                path = $"api/diagnostics/{Uri.EscapeDataString(correlationId)}";
                break;
            case "recent_exceptions":
                var max = hasArguments && arguments.TryGetProperty("max", out var m) && m.TryGetInt32(out var number) ? number : 50;
                path = $"api/diagnostics/recent?max={max}";
                break;
            case "exception_signatures":
                path = "api/diagnostics/signatures";
                break;
            default:
                return Error(id, -32602, $"Unknown tool: {name}");
        }

        var answer = await api.GetAsync(path, Request.Headers.Authorization.ToString(), cancellationToken);
        if (answer.Unreachable)
        {
            return ToolResult(id, "The API could not be reached.", isError: true);
        }

        return answer.StatusCode is >= 200 and < 300
            ? ToolResult(id, answer.Body, isError: false)
            : ToolResult(id, $"The API answered HTTP {answer.StatusCode}. {answer.Body}".Trim(), isError: true);
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
