using Adventures.Data.NQuad;
using Adventures.Entities;
using Adventures.WebApi;
using AiBlogResearch.WebApi;
using Microsoft.Extensions.Options;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>T2: which tenant's graph a request uses, decided from the tenant the server resolved from the host (never from anything the caller sends).</summary>
public sealed class RequestGraphScopeTests
{
    private sealed class Fixed(CurrentTenant current) : IRequestTenant
    {
        public CurrentTenant Current { get; } = current;
    }

    private static IGraphScope Scope(string? tenantId, string? primary, TenantMatch match = TenantMatch.Domain) =>
        new RequestGraphScope(
            new Fixed(new CurrentTenant(tenantId, "n", "example.com", "example.com", match)),
            Options.Create(new TenancyOptions { PrimaryTenantId = primary }));

    [Fact]
    public void The_primary_tenant_keeps_todays_graphs()
    {
        Assert.Null(Scope("t-1", primary: "t-1").TenantKey);
    }

    [Fact]
    public void Another_tenant_is_keyed_by_its_id()
    {
        Assert.Equal("t-2", Scope("t-2", primary: "t-1").TenantKey);
    }

    [Fact]
    public void With_no_primary_configured_scoping_is_off_and_nothing_changes()
    {
        Assert.Null(Scope("t-2", primary: null).TenantKey);
        Assert.Null(Scope("t-2", primary: " ").TenantKey);
    }

    [Fact]
    public void A_request_with_no_resolved_tenant_uses_the_primary_graphs()
    {
        // Tenancy:Enforcement=Enforce refuses an unknown host before any repository is touched; under Report it is served as the primary tenant.
        Assert.Null(Scope(null, primary: "t-1", TenantMatch.None).TenantKey);
    }

    [Fact]
    public void The_primary_id_is_compared_exactly_not_by_prefix_or_case_tricks()
    {
        Assert.Equal("t-10", Scope("t-10", primary: "t-1").TenantKey);
        Assert.Equal("T-1", Scope("T-1", primary: "t-1").TenantKey);
    }
}
