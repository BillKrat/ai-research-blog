// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace McpServer.WebApi.Controllers;

/// <summary>
/// The MCP diagnostics tool as plain REST: read-only eyes into the running system. A caller holding a token with the
/// <c>mcp.diagnostics.read</c> scope asks about a CorrelationId (or for the recent exceptions or the kinds of failure) and
/// this forwards the question to the API (see <see cref="DiagnosticsApiClient"/>). Nothing here changes state. The same tool
/// is offered over the MCP wire protocol by <see cref="McpController"/>.
/// </summary>
[ApiController]
[Route("api/diagnostics")]
[Authorize(Policy = "Scope:" + RequiredScope)]
public sealed class DiagnosticsController(DiagnosticsApiClient api) : ControllerBase
{
    public const string RequiredScope = "mcp.diagnostics.read";
    public const string ApiClientName = DiagnosticsApiClient.ApiClientName;

    [HttpGet("{correlationId}")]
    public Task<IActionResult> ForRequest(string correlationId, CancellationToken cancellationToken) =>
        ForwardAsync($"api/diagnostics/{Uri.EscapeDataString(correlationId)}", cancellationToken);

    [HttpGet("recent")]
    public Task<IActionResult> Recent([FromQuery] int max = 50, CancellationToken cancellationToken = default) =>
        ForwardAsync($"api/diagnostics/recent?max={max}", cancellationToken);

    [HttpGet("signatures")]
    public Task<IActionResult> Signatures(CancellationToken cancellationToken) =>
        ForwardAsync("api/diagnostics/signatures", cancellationToken);

    private async Task<IActionResult> ForwardAsync(string path, CancellationToken cancellationToken)
    {
        var answer = await api.GetAsync(path, Request.Headers.Authorization.ToString(), cancellationToken);
        return answer.Unreachable
            ? StatusCode(
                StatusCodes.Status502BadGateway,
                new { status = 502, title = "The API could not be reached.", correlationId = Adventures.WebApi.CorrelationIdMiddleware.Get(HttpContext) })
            : new ContentResult { StatusCode = answer.StatusCode, Content = answer.Body, ContentType = "application/json" };
    }
}
