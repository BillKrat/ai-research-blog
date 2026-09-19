using System.Security.Claims;
using AiBlogResearch.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

public sealed record TokenRequest(string UserName, string Password);

public sealed record TokenResponse(string AccessToken, DateTimeOffset ExpiresAtUtc);

/// <summary>
/// Issues JWTs after validating credentials.
/// NOTE: credential validation below is a placeholder (configuration-backed demo user) and must be
/// replaced with a real user store (e.g. ASP.NET Identity, a database, etc.) before production use.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(IJwtTokenService tokenService, IConfiguration configuration) : ControllerBase
{
    [HttpPost("token")]
    [AllowAnonymous]
    public ActionResult<TokenResponse> Token([FromBody] TokenRequest request)
    {
        var demoUserName = configuration["DemoUser:UserName"];
        var demoPassword = configuration["DemoUser:Password"];

        if (string.IsNullOrEmpty(demoUserName) || string.IsNullOrEmpty(demoPassword)
            || request.UserName != demoUserName || request.Password != demoPassword)
        {
            return Unauthorized();
        }

        var claims = new[] { new Claim(ClaimTypes.Name, request.UserName) };
        var issued = tokenService.IssueToken(request.UserName, claims);

        return Ok(new TokenResponse(issued.AccessToken, issued.ExpiresAtUtc));
    }

    /// <summary>Sample protected endpoint to prove JWT validation works end to end.</summary>
    [HttpGet("whoami")]
    [Authorize]
    public ActionResult<string> WhoAmI() => Ok(User.Identity?.Name ?? "unknown");
}
