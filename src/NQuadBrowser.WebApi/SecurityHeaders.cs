namespace NQuadBrowser.WebApi;

public static class BrowserSecurityHeaders
{
    /// <summary>
    /// The policy of a host that serves one page and a JSON API: scripts and styles only from this host (no inline code, no eval, no outside
    /// origin), requests only back to this host, no framing. The API-only policy of the shared library (<c>default-src 'none'</c>) would
    /// block the page itself.
    /// </summary>
    public const string ContentSecurityPolicy =
        "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

    public static IApplicationBuilder UseBrowserSecurityHeaders(this IApplicationBuilder app, bool isDevelopment) =>
        app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "DENY";
                headers["Referrer-Policy"] = "no-referrer";
                headers["Content-Security-Policy"] = ContentSecurityPolicy;
                headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";
                if (!isDevelopment && context.Request.IsHttps)
                {
                    headers["Strict-Transport-Security"] = "max-age=15552000";
                }

                return Task.CompletedTask;
            });
            await next();
        });
}
