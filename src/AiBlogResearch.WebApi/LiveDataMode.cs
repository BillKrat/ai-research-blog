namespace AiBlogResearch.WebApi;

/// <summary>
/// "Live data" mode for local development: the app on the developer's machine reads and writes the production store, so the
/// human's replies in the conversation under a post land where Claude reads them. It is opt-in (<c>LiveData:Enabled</c>), takes the
/// connection string from <c>LiveData:ConnectionString</c> (user-secrets, from the vault; never a file in the repo), refuses to run
/// outside the Development environment, and turns off the startup seeding so unmerged work cannot write schemas or data into the
/// live store. The health response and the client's banner tell the person it is on.
/// </summary>
public static class LiveDataMode
{
    public const string EnabledKey = "LiveData:Enabled";
    public const string ConnectionStringKey = "LiveData:ConnectionString";

    /// <summary>
    /// Returns true when live data mode is on, after pointing <c>ConnectionStrings:Postgres</c> at the live store. Throws, with the
    /// reason, when it is switched on outside Development or without a connection string.
    /// </summary>
    public static bool Apply(IConfigurationManager configuration, bool isDevelopment)
    {
        if (!string.Equals(configuration[EnabledKey], "true", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!isDevelopment)
        {
            throw new InvalidOperationException("LiveData:Enabled is only allowed in the Development environment.");
        }

        var connection = configuration[ConnectionStringKey];
        if (string.IsNullOrWhiteSpace(connection))
        {
            throw new InvalidOperationException("LiveData:Enabled is on but LiveData:ConnectionString is not set (store it with Claude-secret.ps1 sync).");
        }

        configuration["ConnectionStrings:Postgres"] = connection;
        return true;
    }
}
