using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// Which tenant this visit is for: the one the server decided from the host it saw (<see cref="IRequestTenant"/>, set by the tenancy middleware). One
/// deployed app serves every tenant's domain; the site is on the tenant's domain and this API on a subdomain of it, so the API's own host names the
/// tenant. Origin and Referer are never read: the caller sets them, and they used to be what this showed.
/// </summary>
[ApiController]
[Route("api/tenant")]
[Authorize]
public sealed class TenantController(IRequestTenant requestTenant) : ControllerBase
{
    [HttpGet("current")]
    public IActionResult Current()
    {
        var current = requestTenant.Current;
        return Ok(new { current.Host, Tenant = current.Id is null ? null : new { current.Id, current.Name, current.Domain }, Match = current.Match.ToString() });
    }
}
