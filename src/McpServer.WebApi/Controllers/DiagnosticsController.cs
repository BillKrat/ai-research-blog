using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace McpServer.WebApi.Controllers;

/// <summary>
/// The MCP diagnostics tool: read-only eyes into the running system. A caller holding a token with the
/// <c>mcp.diagnostics.read</c> scope asks about a CorrelationId (or for the recent exceptions or the kinds of failure) and
/// this forwards the question to the API, which owns the exception store and the log files, with the caller's own token
/// (both sites validate the same issuer and signing key). Nothing here changes state, and the answer is passed through
/// untouched, so the API stays the single place that decides what is shown.
/// </summary>
[ApiController]
[Route("api/diagnostics")]
[Authorize(Policy = "Scope:" + RequiredScope)]
public sealed class DiagnosticsController(IHttpClientFactory httpClientFactory, ILogger<DiagnosticsController> logger) : ControllerBase
{
    public const string RequiredScope = "mcp.diagnostics.read";
    public const string ApiClientName = "Api";

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
        try
        {
            using var client = httpClientFactory.CreateClient(ApiClientName);
            using var request = new HttpRequestMessage(HttpMethod.Get, path);
            if (Request.Headers.Authorization.ToString() is { Length: > 0 } authorization)
            {
                request.Headers.TryAddWithoutValidation("Authorization", authorization);
            }

            using var response = await client.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            return new ContentResult { StatusCode = (int)response.StatusCode, Content = body, ContentType = "application/json" };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // The API being unreachable is itself something to see: say so with the id that finds it in this site's logs.
            logger.LogError(ex, "The diagnostics tool could not reach the API for {Path}", path);
            return StatusCode(StatusCodes.Status502BadGateway, new { status = 502, title = "The API could not be reached.", correlationId = Adventures.WebApi.CorrelationIdMiddleware.Get(HttpContext) });
        }
    }
}
