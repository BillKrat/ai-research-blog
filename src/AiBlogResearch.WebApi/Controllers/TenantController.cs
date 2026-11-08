using Adventures.Entities;
using Adventures.WebApi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiBlogResearch.WebApi.Controllers;

/// <summary>
/// Which tenant this visit is for: the one the server decided from the host it saw (<see cref="IRequestTenant"/>, set by the tenancy middleware). One
/// deployed app serves every tenant's domain; the site is on the tenant's domain and this API on a subdomain of it, so the API's own host names the
/// tenant. Origin and Referer are never read: the caller sets them, and they used to be what this showed. Which host names reach which tenant (aliases) is
/// the platform administrator's to read and change: a host name decides whose data a request sees.
/// </summary>
[ApiController]
[Route("api/tenant")]
[Authorize]
public sealed class TenantController(IRequestTenant requestTenant) : ApiControllerBase
{
    [HttpGet("current")]
    public IActionResult Current()
    {
        var current = requestTenant.Current;
        return Ok(new { current.Host, Tenant = current.Id is null ? null : new { current.Id, current.Name, current.Domain }, Match = current.Match.ToString() });
    }

    /// <summary>Every tenant with the host names that reach it (its domain and its aliases).</summary>
    [HttpGet("hosts")]
    [RequireRight(Rights.PlatformManage)]
    public async Task<IActionResult> Hosts([FromServices] ITenantAliasEditor aliases, CancellationToken cancellationToken) =>
        Ok(await aliases.ListAsync(cancellationToken));

    /// <summary>Makes the host an alias of the tenant, so it mirrors the tenant's own domain. 409 when the name is not a plain host name or already reaches another tenant.</summary>
    [HttpPut("{id}/aliases")]
    [RequireRight(Rights.PlatformManage)]
    public Task<IActionResult> AddAlias(string id, [FromBody] AliasRequest request, [FromServices] ITenantAliasEditor aliases, CancellationToken cancellationToken) =>
        GuardedAsync(async () => await aliases.AddAsync(id, request.Host, cancellationToken) is { } updated ? Ok(updated) : NotFound());

    /// <summary>Takes the alias away; the host stops reaching the tenant (it may take up to a minute: the answer per host is cached briefly).</summary>
    [HttpDelete("{id}/aliases/{host}")]
    [RequireRight(Rights.PlatformManage)]
    public Task<IActionResult> RemoveAlias(string id, string host, [FromServices] ITenantAliasEditor aliases, CancellationToken cancellationToken) =>
        GuardedAsync(async () => await aliases.RemoveAsync(id, host, cancellationToken) is { } updated ? Ok(updated) : NotFound());
}

/// <summary>The host name to add as an alias.</summary>
public sealed record AliasRequest(string Host);
