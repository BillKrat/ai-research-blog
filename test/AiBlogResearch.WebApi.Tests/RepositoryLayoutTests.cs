using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// Layout guard for the decoupling refactor (S1, docs/Claude-architecture-reference.md): every .NET project lives under
/// src, test or tools, the Angular project lives under client, and no source file sits at the repository root.
/// </summary>
public class RepositoryLayoutTests
{
    private static readonly string Root = FindRoot();

    [Fact]
    public void Every_project_lives_under_a_known_folder()
    {
        var stray = Directory.GetFiles(Root, "*.*proj", SearchOption.AllDirectories)
            .Where(f => f.EndsWith(".csproj", StringComparison.Ordinal) || f.EndsWith(".esproj", StringComparison.Ordinal))
            .Select(f => Path.GetRelativePath(Root, f).Replace('\\', '/'))
            .Where(f => !f.Contains("/node_modules/") && !f.Contains("/obj/") && !f.Contains("/bin/"))
            .Where(f => !new[] { "src/", "test/", "tools/", "client/" }.Any(p => f.StartsWith(p, StringComparison.Ordinal)));
        Assert.Empty(stray);
    }

    [Fact]
    public void No_source_files_at_the_repository_root()
    {
        var stray = Directory.GetFiles(Root, "*.cs", SearchOption.TopDirectoryOnly);
        Assert.Empty(stray);
    }

    private static string FindRoot()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d is not null; d = d.Parent)
        {
            if (File.Exists(Path.Combine(d.FullName, "AiBlogResearch.slnx")))
            {
                return d.FullName;
            }
        }

        throw new InvalidOperationException("AiBlogResearch.slnx not found above " + AppContext.BaseDirectory);
    }
}
