using Adventures.Entities;
using Adventures.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// The choices for a pointer field (roles, tenants, organizations) as id and text, for the select a form offers. The schema is
/// named by the field (<c>RefSchema</c> in the form model); only schemas the host registered answer, and only administrators ask.
/// </summary>
[ApiController]
[Route("api/lookups")]
[Authorize(Policy = WellKnownClaims.TenantAdminPolicy)]
public sealed class LookupsController(IEntityRelationProvider provider) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RelationOption>>> Options([FromQuery] string schema, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(schema))
        {
            return BadRequest("A schema is required.");
        }

        var options = await provider.GetOptionsAsync(schema, cancellationToken);
        return options.Count == 0 ? NotFound() : Ok(options);
    }
}
