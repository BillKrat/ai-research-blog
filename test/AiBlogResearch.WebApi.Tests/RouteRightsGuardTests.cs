using System.Reflection;
using Adventures.Entities;
using Adventures.Security;
using Adventures.WebApi;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// S2 guard: every route of the admin API is protected by a right, never a role name. This test fails the day someone adds a controller
/// (or an action) with no right, or goes back to the administrator-role policy, so a route cannot ship open by accident. A controller that
/// is deliberately not right-guarded must be listed here with the reason.
/// </summary>
public sealed class RouteRightsGuardTests
{
    /// <summary>Controllers that are not guarded by a right, and why. Anything not listed here must carry a right.</summary>
    private static readonly Dictionary<string, string> NotRightGuarded = new()
    {
        [nameof(AuthController)] = "sign-in, change password and rights of the caller: per action Authorize or AllowAnonymous",
        [nameof(M2MAuthController)] = "machine token endpoint, authenticated by the client secret",
        [nameof(ClientErrorsController)] = "anonymous browser error reports, capped",
        [nameof(HealthController)] = "health check",
        [nameof(PublicController)] = "the public read side",
        [nameof(SiteController)] = "public site settings",
        [nameof(ProfileController)] = "the signed-in person edits their own profile",
        [nameof(TenantController)] = "which tenant the domain names; display only",
        [nameof(AdminMenuController)] = "the menu lists only what the caller rights allow",
        [nameof(AuthoringController)] = "machine scope policy (content.draft)",
        [nameof(CollaborationAuthoringController)] = "machine scope policy (content.draft)",
        [nameof(McpDiagnosticsController)] = "machine scope policy (mcp.diagnostics.read)",
    };

    private static IEnumerable<Type> Controllers() =>
        typeof(TenantController).Assembly.GetTypes().Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

    private static IEnumerable<MethodInfo> Actions(Type controller) =>
        controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes().Any(a => a is HttpMethodAttribute));

    private static bool HasRight(MemberInfo member) =>
        member.GetCustomAttributes(inherit: true).Any(a => a is AdminRightsAttribute or RequireRightAttribute)
        || (member is MethodInfo && member.GetCustomAttributes(inherit: true).Any(a => a is AllowAnonymousAttribute));

    [Fact]
    public void NoRouteStillUsesTheAdministratorRolePolicy()
    {
        var offenders = Controllers()
            .SelectMany(c => new MemberInfo[] { c }.Concat(Actions(c)))
            .Where(m => m.GetCustomAttributes<AuthorizeAttribute>(inherit: true).Any(a => a.Policy == WellKnownClaims.TenantAdminPolicy || a.Roles is not null))
            .Select(m => m is Type t ? t.Name : $"{m.DeclaringType!.Name}.{m.Name}")
            .ToList();

        Assert.True(offenders.Count == 0, "Guard these with a right: " + string.Join(", ", offenders));
    }

    [Fact]
    public void EveryControllerCarriesARight_OrIsListedWithItsReason()
    {
        var unguarded = Controllers()
            .Where(c => !NotRightGuarded.ContainsKey(c.Name))
            .Where(c => !HasRight(c) && !Actions(c).All(HasRight))
            .Select(c => c.Name)
            .ToList();

        Assert.True(unguarded.Count == 0, "No right on: " + string.Join(", ", unguarded));
    }

    [Fact]
    public void EveryEntityControllerNamesARightForAllFourVerbs_SoNoVerbIsLeftToBeRefusedByAccident()
    {
        var incomplete = Controllers()
            .Where(c => c.GetCustomAttribute<AdminRightsAttribute>() is { } rights
                        && (rights.Read is null || rights.Create is null || rights.Update is null || rights.Delete is null))
            .Select(c => c.Name)
            .ToList();
        var entityControllersWithout = Controllers()
            .Where(c => IsEntityController(c) && c.GetCustomAttribute<AdminRightsAttribute>() is null && !NotRightGuarded.ContainsKey(c.Name))
            .Select(c => c.Name)
            .ToList();

        Assert.True(incomplete.Count == 0, "A verb has no right on: " + string.Join(", ", incomplete));
        Assert.True(entityControllersWithout.Count == 0, "Entity controller without AdminRights: " + string.Join(", ", entityControllersWithout));
    }

    private static bool IsEntityController(Type type)
    {
        for (var baseType = type.BaseType; baseType is not null; baseType = baseType.BaseType)
        {
            if (baseType.IsGenericType && baseType.GetGenericTypeDefinition().Name.StartsWith("AdminEntityControllerBase", StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    [Fact]
    public void EveryRightNamedOnARouteOrMenuEntryExists()
    {
        var named = Controllers()
            .SelectMany(c => new MemberInfo[] { c }.Concat(Actions(c)))
            .SelectMany(m => m.GetCustomAttributes(inherit: true))
            .SelectMany(a => a switch
            {
                RequireRightAttribute require => [require.Right],
                AdminRightsAttribute admin => new[] { admin.Read, admin.Create, admin.Update, admin.Delete }.Where(r => r is not null).Select(r => r!),
                _ => [],
            })
            .Concat(AdminMenuDefinitions.All.Select(item => item.RequiredRight ?? string.Empty))
            .Distinct()
            .ToList();

        Assert.DoesNotContain(string.Empty, named); // every menu entry names a right
        Assert.All(named, right => Assert.True(Rights.IsKnown(right), $"Unknown right {right}"));
    }
}
