// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
using System.Net;
using System.Text.RegularExpressions;

namespace LegacyImport;

/// <summary>
/// Turns a legacy description (BlogEngine stores HTML-ish text, cut at about 100 characters, often mid-word) into the plain text
/// a post or page description should be: tags removed, entities decoded (&amp;rsquo; becomes an apostrophe), spaces collapsed, and a
/// text that was cut mid-sentence shortened to its last whole word with an ellipsis.
/// </summary>
public static partial class DescriptionText
{
    public static string? Clean(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var text = Tags().Replace(raw, " ");
        // decoded twice on purpose: legacy text sometimes holds &amp;rsquo;, an entity that was itself encoded
        text = WebUtility.HtmlDecode(WebUtility.HtmlDecode(text));
        text = Spaces().Replace(text, " ").Trim();
        if (text.Length == 0)
        {
            return null;
        }

        // the legacy field was cut at a fixed length: a text that stops without sentence punctuation loses its half word
        if (text.Length >= 90 && !EndsSentence().IsMatch(text))
        {
            var lastSpace = text.LastIndexOf(' ');
            if (lastSpace > 40)
            {
                text = text[..lastSpace].TrimEnd(',', ';', ':', ' ') + "…";
            }
        }

        return text;
    }

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex Tags();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    [GeneratedRegex(@"[.!?…)""'’”]$")]
    private static partial Regex EndsSentence();
}
