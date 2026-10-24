// Assessed 2026-10-24 17:51 CT (Claude): automated scan for secrets, injection and unsafe patterns, re-run after the fixes - security findings F-1 to F-3 fixed in this file or in code it uses, covered by tests. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using Microsoft.AspNetCore.Mvc;

namespace McpServer.WebApi.Controllers;

public sealed record HealthResponse(string Status, DateTimeOffset TimestampUtc);

[Microsoft.AspNetCore.Authorization.AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public ActionResult<HealthResponse> Get() => Ok(new HealthResponse("Healthy", DateTimeOffset.UtcNow));
}
