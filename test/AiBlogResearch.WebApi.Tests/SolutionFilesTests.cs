using System.Xml;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// The solution files must open (2026-11-24: a scripted edit that read both .slnx files at once wrote the two concatenated into each, three times over, so Visual Studio
/// showed an empty Solution Explorer). Each file is one XML document, lists each project once, and every project it lists exists.
/// </summary>
public sealed class SolutionFilesTests
{
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

    public static TheoryData<string> Files => new() { "AiBlogResearch.slnx", "LocalTriage.slnx" };

    [Theory]
    [MemberData(nameof(Files))]
    public void The_solution_file_is_one_valid_document_with_each_project_once_and_all_of_them_present(string file)
    {
        var document = new XmlDocument();
        document.Load(Path.Combine(Root(), file)); // throws when the file has more than one root element

        var paths = document.SelectNodes("//Project")!.Cast<XmlElement>().Select(p => p.GetAttribute("Path")).ToList();
        Assert.NotEmpty(paths);
        Assert.Empty(paths.GroupBy(p => p, StringComparer.OrdinalIgnoreCase).Where(g => g.Count() > 1).Select(g => g.Key));
        // The poc repo is a read-only reference sibling that CI does not check out.
        Assert.Empty(paths.Where(p => !p.StartsWith("../poc/", StringComparison.OrdinalIgnoreCase) && !File.Exists(Path.GetFullPath(Path.Combine(Root(), p)))));
    }
}
