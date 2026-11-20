# MCP tool inventory and the two-layer plan (2026-11-20)

Groundwork for the human's tools vision (backlog, Features, first entry): the application's own tools work with no MCP server; an
optional MCP server reuses them and adds the research tools. Read-only analysis of `McpServer.WebApi` (nothing was changed).

## What exists today

`McpServer.WebApi/Controllers/McpController.cs` (507 lines) answers JSON-RPC (`initialize`, `tools/list`, `tools/call`) with a hard-coded
list of tools and one `switch` that runs them. There are two kinds of tool.

**Forwarding tools (19).** The server does no work of its own: it checks the scope on the caller's token, then sends the matching request to
the API with the caller's own token. The API decides what is allowed (authoring cannot publish whatever is asked), and its answer text is
the tool result.

| Tool | API request it forwards | Scope on the MCP token |
|---|---|---|
| `diagnose_request` | `GET api/diagnostics/{correlationId}` | `mcp.diagnostics.read` |
| `recent_exceptions` | `GET api/diagnostics/recent?max=` | `mcp.diagnostics.read` |
| `exception_signatures` | `GET api/diagnostics/signatures` | `mcp.diagnostics.read` |
| `list_my_posts` | `GET api/author/posts` | `content.draft` |
| `create_draft_post` | `POST api/author/posts` | `content.draft` |
| `update_draft_post` | `PUT api/author/posts/{id}` | `content.draft` |
| `propose_revision` | `POST api/author/posts/{id}/revision` | `content.draft` |
| `list_post_comments`, `add_post_comment` | `GET/POST api/author/posts/{id}/comments` | `content.draft` |
| `list_categories`, `create_category` | `GET/POST api/author/categories` | `content.draft` |
| `list_tags`, `create_tag` | `GET/POST api/author/tags` | `content.draft` |
| `list_my_collaboration`, `get_collaboration_item` | `GET api/author/collaboration[/{id}]` | `content.draft` |
| `create_collaboration_item`, `update_collaboration_item` | `POST/PUT api/author/collaboration[/{id}]` | `content.draft` |
| `list_collaboration_comments`, `add_collaboration_comment` | `GET/POST api/author/collaboration/{id}/comments` | `content.draft` |

**Research-only tools (about 20).** `blogai_rows` plus the named queries of `BlogAiCatalog` (`blogai_tables`, `blogai_columns`,
`blogai_foreign_keys`, `blogai_blogs`, `blogai_posts`, `blogai_post`, `blogai_post_taxonomy`, `blogai_pages`, `blogai_page`,
`blogai_categories`, `blogai_tags`, `blogai_comments`, `blogai_users`, `blogai_roles`, `blogai_settings`, `blogai_extensions`,
`blogai_custom_fields`, `blogai_files`, `blogai_count`). They read the legacy BlogEngine.NET database directly through `IBlogAiReader`
(SELECT-only login, allow-listed tables), scope `blogai.read`. They do not go through the API.

## The two layers, as the code already has them

- **Layer 1, the app's own tools (no MCP needed):** everything that forwards. The API endpoints under `api/author/*` and
  `api/diagnostics/*` already work for any client with a token (the PowerShell scripts, the WPF client, a developer's own code). So the
  vision holds today: the MCP server is a facade over Layer 1, not its owner.
- **Layer 2, the research tools (MCP only):** the `blogai_*` family, and later the AI-assisted search and upload processing. They need the
  MCP server because they read the legacy store directly and exist for deep research, not for running a blog.

## What blocks the vision (gaps)

1. **The tool list is not extensible.** Adding a tool means editing the static array and the `switch` in `McpController`. A developer's plug-in
   cannot contribute a tool, and a plug-in switched off still has its tools listed by the MCP server (the API refuses, but the model sees them).
2. **Two vocabularies for permission.** The MCP token carries scopes (`content.draft`, `mcp.diagnostics.read`, `blogai.read`); the API decides with
   rights (`posts.*`, `collaboration.*`, `diagnostics.read`). Nothing ties a tool to the right it needs, so the two can drift.
3. **No tool manifest on the API side.** A client without MCP has no way to ask "which tools can I use?"; it must know the routes.
4. **Duplicated argument checks.** The controller repeats "id is required" style checks the API already makes.
5. **Collaboration tools belong to a plug-in.** Developer and Research Collaboration are plug-ins (they can be switched off), but their tools are
   wired into the MCP server by name.
6. **Research tools cannot be told apart in code.** Nothing marks the `blogai_*` tools as MCP-only, so nothing stops a future one from writing.

## Proposed contract (design only, for the human's review)

- **`IAppTool`**, declared by the feature that owns it (the Blog, Collaboration and Diagnostics libraries, or a developer's plug-in through MEF):
  `Name`, `Description`, `InputSchema`, `RequiredRight` (one name, the same one the API enforces), `Method` and `Path` template, and the plug-in that
  owns it. It has no execution code: a Layer 1 tool is a description of an API call.
- **`GET /api/tools`** on the API: the manifest of the tools the caller's rights allow and whose plug-in is on. A plain client reads it; so does
  the MCP server.
- **MCP server:** builds its forwarding tools from that manifest (the static array and the switch go away), maps its token scope to rights once,
  and registers its own **`IMcpOnlyTool`** items (the research tools) in a separate list that is read-only by contract.
- **Guard tests** in the style of the existing architecture tests: every `IAppTool` path exists as a route and carries the right it names; an
  `IMcpOnlyTool` cannot write; the MCP project references no store project except `Adventures.Data.Sql`; a developer's plug-in tool shows up in
  both the manifest and `tools/list` without touching `McpController`.

## Suggested stages (each small, tests first)

1. Tool manifest: `IAppTool`, a registry over DI/MEF, the existing 19 tools described as data, `GET /api/tools`, a guard test that every tool maps
   to a real route and a right. (No behaviour change.)
2. The MCP server reads the manifest; delete the static array and the `switch`; scopes map to rights in one place; `tools/list` follows the
   plug-in state.
3. Mark the research tools `IMcpOnlyTool`; move them behind their own registry; the guard test for read-only.
4. A developer sample: one widget and one tool in a separate project, discovered through MEF, to prove the seam from outside (shared with the
   widget and zone work).

## Questions for the human

1. Should a Layer 1 tool ever have its own code (a computed result, not an API call), or is "a description of an API call" the whole contract? I
   lean to description only; a computed tool is a new endpoint first.
2. Do the diagnostics tools stay Layer 1 (they are app features behind `diagnostics.read`) or become Layer 2 (research and operations)? I lean to
   Layer 1: a blog owner without MCP should still read their own exceptions through the API.
3. Which research tools come next after `blogai_*` (the AI-assisted search and the upload processing you named): are they Layer 2 only, or does a
   simple search of the blog's own content belong in Layer 1 as well? I lean to a basic Layer 1 search, and the AI-assisted one in Layer 2.

## The human's answers (2026-11-20)

1. **A single `IAppTool`, declared by a feature.** A feature (for example a plug-in) declares its tools, so a developer picks which tools are
   on from the screens that already exist (a plug-in feature that declares `IAppTool` is listed in the Plugins grid). Finding a tool is its own
   seam, a **tool selector** interface with our implementation and a replaceable one. Matching may use grep, fuzzy, RegEx, or a function the
   tool's own author writes (`CanHandle(searchKey)` returning true or false), so the responsibility for being found sits with the tool's
   author, not in a description we try to make fit every case. Design: **Chain of Responsibility**; the last link is a `DefaultFallbackTool`
   whose `CanHandle()` always returns true (the best guess; when Claude is configured it asks the AI). Consequence for the contract above:
   the manifest gains `CanHandle(string searchKey)` and the selector walks the chain in order.
2. **Layer 1 for the diagnostics tools** (agreed).
3. **Hybrid search.** The blog's own search tools are Layer 1 (work without MCP) and are Blog-centric; the AI-assisted search reuses them
   instead of indexing every post on save (no RAG pass on each save). The AI's work is uploaded documents, retrieving the applicable posts
   through those tools, and writing a comprehensive answer. **Keep in mind for the private repository:** its search will also cover blogs a
   user subscribes to, so the search tool takes a scope (own blog, subscribed blogs) rather than assuming one.

## Widgets from a C# developer's point of view (human, thinking aloud, 2026-11-20)

An `IWidget` list: a developer drops a DLL in a folder and the widget appears on the Widgets page. Widgets that are best done as an Angular
module would still need Angular, but a C# developer should be able to implement the interface, return HTML, and drop it in without knowing
Angular (the human started with BlogEngine.NET before he knew Angular). Open design questions, not yet decided: how the server-rendered HTML
is sanitised and placed in a zone, how the drop-in folder is discovered (MEF, per tenant?), and how this meets the reviewed upload library.
