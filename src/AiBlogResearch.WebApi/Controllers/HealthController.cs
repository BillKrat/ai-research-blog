using System.Net.Http.Headers;
using System.Net.Http.Json;
using Adventures.Security;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController(
    IJwtTokenService tokenService,
    IHttpClientFactory httpClientFactory,
    ILogger<HealthController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken cancellationToken)
    {
        var (mcpMessage, mcpStatus) = await TryGetMcpHelloMessageAsync(cancellationToken);
        return Ok(new HealthResponse("Healthy", DateTimeOffset.UtcNow, mcpMessage, mcpStatus));
    }

    /// <summary>
    /// Calls mcp.global-webnet.com's M2M-protected /api/hello over a token this app mints for itself
    /// (it's the same JWT issuer mcp validates against, via the shared Adventures.Security signing
    /// key - see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md for the full pipeline). Fails soft:
    /// a down/misconfigured mcp site degrades this one field instead of making /api/health itself
    /// unavailable, since this is a downstream dependency check, not the health of this app itself.
    /// McpStatus is deliberately non-sensitive (a short reason code, never a token/secret/exception
    /// message) - added after this pipeline's first real deploy silently returned a null message
    /// with nothing to diagnose it by (see docs/artifacts/2026-09-23-mcp-m2m-hello-world.md).
    /// </summary>
    private async Task<(string? Message, string Status)> TryGetMcpHelloMessageAsync(CancellationToken cancellationToken)
    {
        try
        {
            var token = tokenService.IssueClientToken("mcp-host", ["mcp.hello"]).AccessToken;

            using var client = httpClientFactory.CreateClient("McpServer");
            using var request = new HttpRequestMessage(HttpMethod.Get, "api/hello");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning(
                    "mcp.global-webnet.com/api/hello returned {StatusCode} {ReasonPhrase}. Body: {Body}",
                    (int)response.StatusCode,
                    response.ReasonPhrase,
                    body);
                return (null, $"http_{(int)response.StatusCode}");
            }

            var parsed = await response.Content.ReadFromJsonAsync<McpHelloResponse>(cancellationToken);
            return (parsed?.Message, "ok");
        }
        catch (Exception ex)
        {
            // Broad catch deliberately: this is a downstream health probe, not core request
            // handling - no exception type here should ever turn /api/health itself into a 500.
            logger.LogWarning(ex, "Failed to reach mcp.global-webnet.com for the health check's mcp message.");
            return (null, $"exception_{ex.GetType().Name}");
        }
    }

    private sealed record McpHelloResponse(string Message);
}

public record HealthResponse(string Status, DateTimeOffset TimestampUtc, string? McpMessage = null, string? McpStatus = null);
