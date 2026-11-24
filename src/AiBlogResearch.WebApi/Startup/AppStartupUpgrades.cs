// Startup composition: what runs once the host is built, before it serves (moved out of Program.cs, no behaviour change).
using Adventures.Common.Diagnostics;
using Adventures.Data;
using Adventures.Data.Postgres;
using Adventures.Identity.Postgres;
using Adventures.Data.NQuad;
using Adventures.Entities;
using Adventures.Identity;
using Adventures.Ioc.Extensions;
using Adventures.Security;
using Adventures.WebApi;
using AiBlogResearch.WebApi;
using Microsoft.AspNetCore.Diagnostics;
using Serilog;
using Adventures.Blog;
using Adventures.Blog.Legacy;
using Adventures.Blog.WebApi;
using Adventures.Collaboration.WebApi;
using Adventures.Diagnostics.WebApi;
using Adventures.Identity.WebApi;
using Adventures.Blog.Postgres;
using Adventures.Collaboration;
using Adventures.MEF;

namespace AiBlogResearch.WebApi;

internal static class AppStartupUpgrades
{
    // legacy: the collaboration plug-ins are fixed off by LegacyModePlugins (nothing is written here, there is no tenant at start-up)
    public static async Task ApplyAsync(this WebApplication app, bool legacy, bool skipSeeding)
    {
        if (!skipSeeding)
        {
            // The sign-in tables (CREATE ... IF NOT EXISTS: nothing changes where they exist). A host without the right to create them logs it and carries on.
            if (!legacy)
            {
                try
                {
                    await app.Services.GetRequiredService<IdentitySchemaInitializer>().EnsureAsync();
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Could not make sure the sign-in tables exist (identity schema); continuing.");
                }
            }

            // Improved default rights for roles still at their first shipped values (a seed cannot supersede a stored value); an edited role is left alone.
            using var upgradeScope = app.Services.CreateScope();
            var upgraded = await RoleRightsUpgrade.ApplyAsync(upgradeScope.ServiceProvider.GetRequiredService<IEntityDal<Role>>());

            if (upgraded > 0)
            {
                Log.Information("Upgraded the default rights of {Count} role(s).", upgraded);
            }

            // When nobody is a platform administrator yet, Admin becomes one (never again once someone holds it, so a person switched off on purpose stays off).
            if (await upgradeScope.ServiceProvider.GetRequiredService<PlatformAdministratorBll>().EnsureFirstAsync())
            {
                Log.Information("{UserName} is now the platform administrator (nobody held the switch).", PlatformAdministratorBll.FirstAdministratorUserName);
            }
        }
    }
}
