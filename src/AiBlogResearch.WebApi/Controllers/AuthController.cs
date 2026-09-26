using Adventures.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

public sealed record TokenRequest(string UserName, string Password);

public sealed record TokenResponse(string AccessToken, DateTimeOffset ExpiresAtUtc, bool MustChangePassword);

/// <summary>
/// Issues JWTs after validating credentials against the real user store (Adventures.Data +
/// Adventures.Identity), replacing the config-seeded demo-user placeholder this controller used
/// to have - see docs/artifacts/Claude-2026-09-21-real-login-wired.md for why that replacement
/// was deferred until the underlying login path was verified end-to-end first.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(IUserAccountService accountService, IConfiguration configuration) : ControllerBase
{
    /// <summary>
    /// Single-tenant today (see <c>Auth:Tenant</c> in configuration, defaulting to
    /// "global-webnet.com") - <see cref="IUserAccountService.LoginAsync"/> is tenant-scoped for
    /// when this app supports more than one, but nothing yet needs the client to supply it.
    /// </summary>
    private string Tenant => configuration["Auth:Tenant"] ?? "global-webnet.com";

    [HttpPost("token")]
    [AllowAnonymous]
    public async Task<ActionResult<TokenResponse>> Token([FromBody] TokenRequest request)
    {
        var result = await accountService.LoginAsync(Tenant, request.UserName, request.Password);
        if (!result.Succeeded)
        {
            return Unauthorized();
        }

        return Ok(new TokenResponse(result.AccessToken!, result.ExpiresAtUtc!.Value, result.MustChangePassword));
    }

    /// <summary>Sample protected endpoint to prove JWT validation works end to end.</summary>
    [HttpGet("whoami")]
    [Authorize]
    public ActionResult<string> WhoAmI() => Ok(User.Identity?.Name ?? "unknown");
}
