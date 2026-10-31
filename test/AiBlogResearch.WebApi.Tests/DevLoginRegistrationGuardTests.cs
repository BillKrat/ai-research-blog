using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// The developer-testing sign-in (Admin / Password) must be reachable only in Legacy mode. The gates inside it are unit-tested in the Foundation; this
/// pins the other half: the host registers it in exactly one place, inside the Legacy branch, and nowhere else.
/// </summary>
public class DevLoginRegistrationGuardTests
{
    [Fact]
    public void AddDevLogin_is_called_once_and_only_inside_the_Legacy_branch()
    {
        var program = File.ReadAllLines(Path.Combine(FindRoot(), "src", "AiBlogResearch.WebApi", "Program.cs"));
        var calls = program.Select((line, index) => (line, index)).Where(x => x.line.Contains("AddDevLogin(", StringComparison.Ordinal)).ToList();

        var call = Assert.Single(calls);
        var branch = program.Take(call.index).Reverse().FirstOrDefault(l => l.TrimStart().StartsWith("if (", StringComparison.Ordinal) || l.TrimStart().StartsWith("else", StringComparison.Ordinal));
        Assert.NotNull(branch);
        Assert.Contains("if (legacy)", branch);
    }

    [Fact]
    public void The_password_literal_lives_in_one_source_file_of_the_Foundation_and_nowhere_in_the_app()
    {
        var app = Directory.GetFiles(Path.Combine(FindRoot(), "src"), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
            .Where(f => File.ReadAllText(f).Contains("\"Password\"", StringComparison.Ordinal));
        Assert.Empty(app);
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

        throw new InvalidOperationException("AiBlogResearch.slnx not found.");
    }
}
