# Stage review: legacy import, stage 2 (the code-heavy MCP bridge posts)

*2026-10-21. Branch `claude-legacy-import` here and in the workspace root. Four drafts created on the live site; nothing published.*

## Scope

The agreed scope is the 19 **published** legacy posts. Of the 13 posts in the MCP bridge / VSIX family only four are published; they are the stage 2 set. The other nine (VS MCP Bridge series parts 1 to 7, "Understanding AI Chat Sessions, Models, and Agents", "How stdio Works in VS MCP Bridge") are unpublished drafts on the legacy site and stay behind unless you say otherwise.

| Legacy post | New draft id | Fenced blocks | Inline code |
|---|---|---|---|
| WPF VSIX Threading: Understanding UI Switching, Async Behavior, and Pipe Safety | `6d9908e4-5448-4eb7-b5dc-34fc6b52e1a0` | 5 | 12 |
| Why a VSIX Project Should Target .NET Framework 4.7.2 | `5838febf-cdcf-451f-a0f2-f7fc40f553a2` | 0 | 8 |
| Understanding a Local MCP Server Over Stdio and Local-Only Communication Over a Named Pipe | `fb1aa452-7325-4556-93df-9569d0b19139` | 3 | 12 |
| Understanding a Named Pipe Listener | `e19cbc4c-5b90-4a77-8d26-e3b250c37bd9` | 5 | 22 |

All four are in the category **MCP** (legacy "MCP Bridge" maps to it; "AI Systems Author" was dropped as it has no counterpart). They keep their legacy slugs. No images.

## Fidelity checks run

- The number of fenced blocks equals the number of `<pre>` elements in each source; no HTML tags are left in the Markdown; headings, lists, links and inline code converted.
- The language hint survived where the legacy markup named one (three C# blocks in the named-pipe post); the other blocks are plain text (diagrams, command output), which is what they were.
- One legacy wiki command, `[Page:NamedPipeListener]` (the fork's wiki link, a self-reference with nothing to link to now), was found at the top of the named-pipe post and removed. The converter now reports every such command instead of silently keeping or dropping it (test added).

## Two defects found and fixed along the way

1. **Non-ASCII text broke the author call.** Windows PowerShell 5.1 sends a string body as Latin-1; one post had curly quotes and an em dash and the server answered 400 (invalid JSON). `Claude-author.ps1` and `Claude-blogai.ps1` now send UTF-8 bytes. The other three posts are pure ASCII, so none was affected; the fourth was created after the fix.
2. **Legacy categories** are mapped instead of copied blindly (see above).

## What to check

Open each draft in Admin > Posts: the code blocks should read as code (indentation kept), the diagrams as plain blocks, links intact. The named-pipe post should open directly with its introduction. If they look right, publish them. Stage 3 next: the remaining published posts (the DI post with 13 images, prompting and AI essays, "Models and Agents and Tools" with a mind-map image) and the page tree.
