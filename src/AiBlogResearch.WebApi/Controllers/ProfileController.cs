using System.Security.Claims;
using System.Text.Json;
using Adventures.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>One renderable field, mirroring poc/nquad-end-to-end-poc's EntitySchemaField shape
/// (Id/Name/Type/IsRequired) closely enough that the client's form can stay schema-driven - see
/// docs/artifacts/Claude-2026-09-24-login-screen-end-to-end.md, gap 3. This is deliberately a small,
/// hand-written field list, not the full GenericDal/GenericBll engine (that doesn't exist in this
/// repo - see the POC's own docs/artifacts/ for its current state).</summary>
public sealed record ProfileField(string Id, string Name, string Type, bool IsRequired, bool IsReadOnly, string Value);

public sealed record ProfileResponse(IReadOnlyList<ProfileField> Fields);

public sealed record UpdateProfileRequest(string Email, string DisplayName);

/// <summary>
/// Reads/writes the current user's profile directly against the `entities.standard_fields` JSONB
/// shape documented in Adventures.Data's schema-users.sql (username/email/display_name/status/roles) -
/// not through IUserAccountService, which only exposes LoginAsync today. Going straight at
/// IEntityRepository (already registered in Program.cs) keeps this a modest, real feature instead of
/// requiring a new Adventures.Identity method/package version just to unblock a profile page.
/// </summary>
[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController(IEntityRepository entityRepository) : ControllerBase
{
    private const string UserEntityType = "user";

    [HttpGet("me")]
    public async Task<ActionResult<ProfileResponse>> Me(CancellationToken cancellationToken)
    {
        var userId = ResolveUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var entity = await entityRepository.GetAsync(userId.Value, cancellationToken);
        if (entity is null || entity.EntityType != UserEntityType)
        {
            return NotFound();
        }

        return Ok(BuildResponse(entity));
    }

    [HttpPut("me")]
    public async Task<ActionResult<ProfileResponse>> UpdateMe([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = ResolveUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var entity = await entityRepository.GetAsync(userId.Value, cancellationToken);
        if (entity is null || entity.EntityType != UserEntityType)
        {
            return NotFound();
        }

        using var doc = JsonDocument.Parse(entity.StandardFieldsJson);
        var fields = new Dictionary<string, JsonElement>();
        foreach (var property in doc.RootElement.EnumerateObject())
        {
            fields[property.Name] = property.Value;
        }

        var updatedJson = JsonSerializer.Serialize(new
        {
            username = ReadString(doc.RootElement, "username"),
            email = request.Email,
            display_name = request.DisplayName,
            status = ReadString(doc.RootElement, "status"),
            roles = ReadRolesArray(doc.RootElement),
        });

        var updated = entity with { StandardFieldsJson = updatedJson };
        var saved = await entityRepository.UpdateAsync(updated, cancellationToken);
        if (!saved)
        {
            return Conflict("Profile was modified elsewhere - reload and try again.");
        }

        var refreshed = await entityRepository.GetAsync(userId.Value, cancellationToken);
        return Ok(BuildResponse(refreshed!));
    }

    private static ProfileResponse BuildResponse(Entity entity)
    {
        using var doc = JsonDocument.Parse(entity.StandardFieldsJson);
        var root = doc.RootElement;

        var fields = new List<ProfileField>
        {
            new("username", "Username", "text", IsRequired: true, IsReadOnly: true, ReadString(root, "username")),
            new("email", "Email", "email", IsRequired: true, IsReadOnly: false, ReadString(root, "email")),
            new("display_name", "Display name", "text", IsRequired: false, IsReadOnly: false, ReadString(root, "display_name")),
            new("status", "Status", "text", IsRequired: false, IsReadOnly: true, ReadString(root, "status")),
            new("roles", "Roles", "text", IsRequired: false, IsReadOnly: true, ReadRoles(root)),
        };

        return new ProfileResponse(fields);
    }

    /// <summary>
    /// The caller's GUID lands in the JWT under the short "sub" claim - unlike the username claim
    /// AuthController's own remarks describe, "sub" is already short so the low-level
    /// JwtSecurityToken(claims:...) constructor's missing outbound-shortening doesn't affect it. But
    /// ASP.NET Core's inbound claim-type mapping (Adventures.Security's AddSharedJwtAuthentication
    /// call configures this, not visible from this repo) can still present it to ClaimsPrincipal as
    /// either "sub" or the long ClaimTypes.NameIdentifier URI depending on that setting - check both
    /// rather than guess which one is active.
    /// </summary>
    private static Guid? ResolveUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirst("sub")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private static string ReadString(JsonElement root, string propertyName) =>
        root.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;

    private static string ReadRoles(JsonElement root) =>
        root.TryGetProperty("roles", out var value) && value.ValueKind == JsonValueKind.Array
            ? string.Join(", ", value.EnumerateArray()
                .Select(r => r.GetString())
                .Where(r => !string.IsNullOrEmpty(r)))
            : string.Empty;

    private static string[] ReadRolesArray(JsonElement root) =>
        root.TryGetProperty("roles", out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().Select(r => r.GetString() ?? string.Empty).ToArray()
            : [];
}
