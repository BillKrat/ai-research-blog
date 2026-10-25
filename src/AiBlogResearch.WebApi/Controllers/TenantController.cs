using Adventures.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// Which tenant this visit is for, from the domain it came in on (one deployed app serves every tenant's domain). The site is on the tenant's
/// domain and this API on a subdomain of it, so the browser's Origin names the tenant; the API's own host is the fallback for a direct call.
/// Display only: the value comes from a header the caller controls, so nothing may be authorized or scoped by it without more checks.
/// </summary>
[ApiController]
[Route("api/tenant")]
[Authorize]
public sealed class TenantController(ITenantResolver tenants, IConfiguration configuration) : ControllerBase
{
    [HttpGet("current")]
    public async Task<IActionResult> Current(CancellationToken cancellationToken)
    {
        var host = HostOf(Request.Headers.Origin.ToString()) ?? HostOf(Request.Headers.Referer.ToString()) ?? Request.Host.Value;
        var current = await tenants.ResolveAsync(host, configuration["Tenancy:FallbackDomain"], cancellationToken);
        return Ok(new { current.Host, Tenant = current.Id is null ? null : new { current.Id, current.Name, current.Domain }, Match = current.Match.ToString() });
    }

    private static string? HostOf(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme is "http" or "https") ? uri.Authority : null;
}
