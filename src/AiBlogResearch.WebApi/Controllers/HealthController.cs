using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public ActionResult<HealthResponse> Get() =>
        Ok(new HealthResponse("Healthy", DateTimeOffset.UtcNow));
}

public record HealthResponse(string Status, DateTimeOffset TimestampUtc);
