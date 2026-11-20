// Startup composition: the HTTP request pipeline and its endpoints (moved out of Program.cs, no behaviour change).
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

internal static class AppPipeline
{
    public static void UseAppPipeline(this WebApplication app)
    {
        const string AngularCorsPolicy = AppPlatformServices.AngularCorsPolicy;

        // First in the pipeline: everything after it (request logging, the exception handler, controllers) logs under the id.
        app.UseCorrelationId();
        app.UseSecurityHeaders(app.Environment.IsDevelopment());
        app.Use(async (context, next) =>
        {
            using (Serilog.Context.LogContext.PushProperty(CorrelationIdMiddleware.LogPropertyName, CorrelationIdMiddleware.Get(context)))
            {
                await next(context);
            }
        });
        app.UseSerilogRequestLogging();

        // Configure the HTTP request pipeline.
        // UseCors must come before any Map* calls so it runs ahead of terminal
        // middleware (health checks, controllers) and can attach CORS headers.
        // The root stays reachable over plain HTTP: SmarterASP's free-SSL preflight requests it
        // without following redirects, so redirecting "/" would fail issue and renewal.
        app.UseWhen(context => !context.Request.Path.Equals("/"), branch => branch.UseHttpsRedirection());
        app.UseCors(AngularCorsPolicy);
        app.UseRateLimiter();

        // One handler in every environment, so what a developer sees is what production does: the full exception goes to the
        // log file and the exception log, the client gets a shielded body with a reference (see UnhandledExceptionHandler).
        // Without a handler an exception anywhere in the pipeline (authentication and authorization included) would fall
        // through to IIS's own bare error page with nothing logged.
        app.UseExceptionHandler(errorApp => errorApp.Run(UnhandledExceptionHandler.HandleAsync));
        // After the exception handler and the rate limiter, before authentication: a host that matches no tenant never reaches the controllers when enforcement is on.
        app.UseTenancy();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi().AllowAnonymous();
        }

        app.MapDefaultEndpoints();

        app.UseAuthentication();
        app.UseTenantTokenCheck();
        app.UseActingTenant();
        app.UsePasswordChangeRequired();
        app.UseAuthorization();

        app.MapControllers();

        if (app.Environment.IsDevelopment())
        {
            // Test aid, not a feature: throws on purpose so the exception log, the header warning and the Exceptions screen
            // can be exercised end to end. Development only (not mapped in production), administrators only.
            static IResult ThrowDeliberately() => throw new InvalidOperationException("Deliberate test exception from /api/dev/throw.");
            app.MapGet("/api/dev/throw", ThrowDeliberately)
                .RequireAuthorization(WellKnownClaims.TenantAdminPolicy)
                .ExcludeFromDescription();
        }

        // SmarterASP's free-SSL request (issue and renewal) requires the domain root to return HTTP 200.
        app.MapGet("/", () => Results.Ok(new { service = "AiBlogResearch.WebApi", status = "ok" })).AllowAnonymous()
            .ExcludeFromDescription();
    }
}
