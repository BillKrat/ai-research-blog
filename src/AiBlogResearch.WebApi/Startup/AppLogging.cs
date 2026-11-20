// Startup composition: the Serilog pipeline (moved out of Program.cs, no behaviour change).
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

internal static class AppLogging
{
    /// <summary>Text log for people, compact JSON sibling for tools; every line carries the request's CorrelationId.</summary>
    public static void UseAppSerilog(this ConfigureHostBuilder host)
    {
            // Every line carries the request's CorrelationId (pushed by the middleware below into the LogContext). The text log is
            // for people; the compact JSON sibling (one JSON object per line, "CorrelationId" a top-level field) is for tools - an
            // MCP diagnostics tool filters it by id without parsing text.
            const string LogTemplate = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}";
            host.UseSerilog((context, services, configuration) => configuration
                .ReadFrom.Configuration(context.Configuration)
                .ReadFrom.Services(services)
                .Enrich.FromLogContext()
                .WriteTo.Console(outputTemplate: LogTemplate)
                .WriteTo.File(
                    Path.Combine(AppContext.BaseDirectory, "logs", "webapi-.log"),
                    outputTemplate: LogTemplate,
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 14)
                .WriteTo.File(
                    new Serilog.Formatting.Compact.RenderedCompactJsonFormatter(),
                    Path.Combine(AppContext.BaseDirectory, "logs", "webapi-json-.log"),
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 14));
    }
}
