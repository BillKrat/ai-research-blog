namespace McpServer.WebApi;

/// <summary>The API's answer to a forwarded diagnostics question: its status and body, untouched, or a 502 when it could not be reached.</summary>
public sealed record ApiAnswer(int StatusCode, string Body, bool Unreachable = false);

/// <summary>
/// Asks the API (which owns the exception store and the log files) a read-only diagnostics question with the caller's own
/// token (both sites validate the same issuer and signing key). Shared by the REST controller and the MCP wire-protocol
/// endpoint so both pass the answer through untouched and the API stays the single place that decides what is shown.
/// </summary>
public sealed class DiagnosticsApiClient(IHttpClientFactory httpClientFactory, ILogger<DiagnosticsApiClient> logger)
{
    public const string ApiClientName = "Api";

    public async Task<ApiAnswer> GetAsync(string path, string? authorization, CancellationToken cancellationToken)
    {
        try
        {
            using var client = httpClientFactory.CreateClient(ApiClientName);
            using var request = new HttpRequestMessage(HttpMethod.Get, path);
            if (!string.IsNullOrEmpty(authorization))
            {
                request.Headers.TryAddWithoutValidation("Authorization", authorization);
            }

            using var response = await client.SendAsync(request, cancellationToken);
            return new ApiAnswer((int)response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // The API being unreachable is itself something to see: say so with the id that finds it in this site's logs.
            logger.LogError(ex, "The diagnostics tool could not reach the API for {Path}", path);
            return new ApiAnswer(StatusCodes.Status502BadGateway, string.Empty, Unreachable: true);
        }
    }
}
