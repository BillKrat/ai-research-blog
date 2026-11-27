using System.Text.Json;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// The schema browser host (in the sibling Adventures.Foundation repository) accepts this API's tokens, so the two name the same issuer and audience.
/// </summary>
public sealed class BrowserHostTokenTests
{
    [Theory]
    [InlineData("Issuer")]
    [InlineData("Audience")]
    public void The_browser_host_expects_the_token_this_API_issues(string key)
    {
        var root = Root();

        Assert.Equal(
            Setting(Path.Combine(root, "src", "AiBlogResearch.WebApi", "appsettings.json"), key),
            Setting(Path.Combine(root, "..", "Adventures.Foundation", "apps", "Adventures.Browser.Host", "appsettings.json"), key));
    }

    private static string Setting(string file, string key)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(file), new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true });
        return document.RootElement.GetProperty("Jwt").GetProperty(key).GetString()!;
    }

    private static string Root()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d is not null; d = d.Parent)
        {
            if (File.Exists(Path.Combine(d.FullName, "AiBlogResearch.slnx")))
            {
                return d.FullName;
            }
        }

        throw new InvalidOperationException("AiBlogResearch.slnx not found.");
    }
}
