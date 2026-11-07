using Adventures.Data.NQuad;
using Adventures.Entities;
using Adventures.WebApi;
using AiBlogResearch.WebApi;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>T2: which tenant's graph a request uses, decided from the tenant the server resolved from the host (never from anything the caller sends). Every tenant has its own graph.</summary>
public sealed class RequestGraphScopeTests
{
    private sealed class Fixed(CurrentTenant current) : IRequestTenant
    {
        public CurrentTenant Current { get; } = current;
    }

    private static IGraphScope Scope(string? tenantId, TenantMatch match = TenantMatch.Domain) =>
        new RequestGraphScope(new Fixed(new CurrentTenant(tenantId, "n", "example.com", "example.com", match)));

    [Fact]
    public void The_key_is_the_resolved_tenants_id()
    {
        Assert.Equal("t-1", Scope("t-1").TenantKey);
        Assert.Equal("t-2", Scope("t-2").TenantKey);
    }

    [Fact]
    public void The_development_fallback_tenant_is_a_tenant_like_any_other()
    {
        Assert.Equal("t-1", Scope("t-1", TenantMatch.Fallback).TenantKey);
    }

    [Fact]
    public void A_request_with_no_resolved_tenant_has_no_graph_and_never_falls_into_another()
    {
        Assert.Throws<TenantRequiredException>(() => Scope(null, TenantMatch.None).TenantKey);
        Assert.Throws<TenantRequiredException>(() => Scope(" ", TenantMatch.None).TenantKey);
    }
}
