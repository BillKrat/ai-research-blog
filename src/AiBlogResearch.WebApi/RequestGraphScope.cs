using Adventures.Data.NQuad;
using Adventures.WebApi;
using Microsoft.Extensions.Options;

namespace AiBlogResearch.WebApi;

/// <summary>
/// The graph scope of one request (T2): the tenant the server resolved from the host it saw, as an id. The primary tenant
/// (<c>Tenancy:PrimaryTenantId</c>) keeps today's graphs, so the live data is untouched; any other tenant reads and writes its own graph.
/// With no primary configured, scoping is off. Nothing here reads a header the caller controls.
/// </summary>
public sealed class RequestGraphScope(IRequestTenant requestTenant, IOptions<TenancyOptions> options) : IGraphScope
{
    public string? TenantKey
    {
        get
        {
            var primary = options.Value.PrimaryTenantId;
            var id = requestTenant.Current.Id;
            if (string.IsNullOrWhiteSpace(primary) || string.IsNullOrWhiteSpace(id))
            {
                return null;
            }

            return string.Equals(id, primary, StringComparison.Ordinal) ? null : id;
        }
    }
}
