using Microsoft.AspNetCore.Mvc;

namespace McpServer.WebApi.Controllers;

public sealed record HealthResponse(string Status, DateTimeOffset TimestampUtc);

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public ActionResult<HealthResponse> Get() => Ok(new HealthResponse("Healthy", DateTimeOffset.UtcNow));
}
