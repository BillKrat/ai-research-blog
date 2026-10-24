// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using LegacyImport;
using Xunit;

namespace LegacyImport.Tests;

public sealed class DescriptionTextTests
{
    [Fact]
    public void EntitiesAreDecoded_AndTagsRemoved()
    {
        Assert.Equal("Author’s Note: short.", DescriptionText.Clean("<p>Author&rsquo;s   Note: short.</p>"));
        Assert.Equal("Fish & chips \"fresh\".", DescriptionText.Clean("Fish &amp;amp; chips &quot;fresh&quot;."));
    }

    [Fact]
    public void ATextCutMidWord_EndsAtItsLastWholeWordWithAnEllipsis()
    {
        var cut = "Author&rsquo;s Note: In my previous post, I worked through the abstract of the Direct Corpus Interac";

        Assert.Equal("Author’s Note: In my previous post, I worked through the abstract of the Direct Corpus…", DescriptionText.Clean(cut));
    }

    [Fact]
    public void AFinishedSentenceOrAShortText_IsLeftAlone()
    {
        Assert.Equal("Modern AI systems blur the words model, agent, and tool. That can make papers about agentic systems hard to follow.",
            DescriptionText.Clean("Modern AI systems blur the words model, agent, and tool. That can make papers about agentic systems hard to follow."));
        Assert.Equal("Short note", DescriptionText.Clean("Short note"));
        Assert.Null(DescriptionText.Clean("  <br/> "));
        Assert.Null(DescriptionText.Clean(null));
    }
}
