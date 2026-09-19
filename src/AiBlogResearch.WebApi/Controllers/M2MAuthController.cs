using AiBlogResearch.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

public sealed record M2MTokenRequest(string ClientId, string ClientSecret, string? Scope);

public sealed record M2MTokenResponse(string AccessToken, DateTimeOffset ExpiresAtUtc, string Scope);

/// <summary>
/// Issues machine-to-machine JWTs via the OAuth2 client-credentials grant, for use between the
/// MCP Host and MCP servers. Client identities/secrets/scopes come from <see cref="IClientCredentialStore"/>
/// (in-memory, configuration-seeded for now; a database-backed store can replace it later).
/// </summary>
[ApiController]
[Route("api/auth/m2m")]
public sealed class M2MAuthController(
    IJwtTokenService tokenService,
    IClientCredentialStore clientStore,
    IClientSecretHasher secretHasher) : ControllerBase
{
    [HttpPost("token")]
    [AllowAnonymous]
    public ActionResult<M2MTokenResponse> Token([FromBody] M2MTokenRequest request)
    {
        var client = clientStore.FindByClientId(request.ClientId);
        if (client is null || !secretHasher.Verify(request.ClientSecret, client.HashedSecret))
        {
            return Unauthorized();
        }

        var requestedScopes = string.IsNullOrWhiteSpace(request.Scope)
            ? client.AllowedScopes
            : request.Scope.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        var grantedScopes = requestedScopes.Intersect(client.AllowedScopes, StringComparer.Ordinal).ToArray();
        if (grantedScopes.Length == 0)
        {
            return Unauthorized();
        }

        var issued = tokenService.IssueClientToken(client.ClientId, grantedScopes);

        return Ok(new M2MTokenResponse(issued.AccessToken, issued.ExpiresAtUtc, string.Join(' ', grantedScopes)));
    }
}
