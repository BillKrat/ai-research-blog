---
title: The MCP server in this app, end to end
description: How the Model Context Protocol server works here - the wire protocol, how a tool is declared once and listed from the API's manifest, how scopes protect it, and what to reuse in your own organisation.
categories: MCP, Development log
tags: MCP, Diagnostics, Authoring, Security, Tools
comments: true
---

This post explains the one piece of this project that most teams ask about first: the **MCP server**. It is small on purpose, and everything below is in the repository, so you can read the code while you read this.

## What MCP is, in one paragraph

The Model Context Protocol lets an AI client discover and call **tools** on a server. The client does not need to know your REST routes; it asks the server what tools exist, reads their descriptions and input schemas, and calls them. On the wire it is plain JSON-RPC 2.0: one HTTP `POST` endpoint, a handful of methods. Our server answers with ordinary JSON, which the "streamable HTTP" transport allows.

## The conversation

Every session is the same three calls (`POST https://<your-mcp-site>/mcp`, with a bearer token):

```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2025-03-26" } }
```

The server answers with its name, version, capabilities (`tools`) and short instructions for the model. Then the client lists what it may use:

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

and calls one:

```json
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": { "name": "recent_exceptions", "arguments": { "max": 5 } } }
```

The result carries `content` (text) and `isError`. A refusal or an outage is a **tool error** (`isError: true` with the reason), not a protocol failure, so the model reads why it failed and can react. Notifications (a message with no `id`, such as `notifications/initialized`) get an empty `202`.

## A tool is declared once, in the API, and the MCP server reads the list

Each tool is one declaration: a name, a description written for a model, a JSON-schema for its arguments, the **scope** that unlocks it, and the **route** it maps to (`IAppTool`, in the `Adventures.Tools` library). The libraries that own a feature declare their tools as data next to their controllers, so adding a capability to the API and adding its tool are the same change.

The API publishes the list at `GET /api/tools`, already filtered by the caller's scopes and by which plug-ins are switched on for the site. The MCP server **builds its `tools/list` from that manifest** (cached for a minute per token) and, when a tool is called, **forwards one request to the API with the caller's own token** and returns the API's answer text. That choice matters:

- The API stays the single place that decides what is allowed. The MCP server cannot do anything the caller could not do by calling the API directly.
- A new tool is a few lines of data. A **plug-in** can add its own tools, and they appear for exactly the sites that have the plug-in on.
- The same manifest works without an MCP server: the app's own tools are the API, and MCP is one way to reach them.
- Everything is testable without an AI: the tests post JSON-RPC and assert the forwarded request.

## The tools and their scopes

| Scope | Tools | What they can do |
|---|---|---|
| `mcp.diagnostics.read` | `diagnose_request`, `get_exception`, `recent_exceptions`, `exception_signatures` | Read-only: find what went wrong for a request by its correlation id |
| `content.draft` | `list_my_posts`, `create_draft_post`, `update_draft_post`, `propose_revision`, `list_post_comments`, `add_post_comment`, `list_categories`, `list_tags`, `create_category`, `create_tag` | Write **drafts** only, under one fixed author account |
| `content.draft` | `list_my_collaboration`, `get_collaboration_item`, `create_collaboration_item`, `update_collaboration_item`, `list_collaboration_comments`, `add_collaboration_comment` | Read and write the review items between a person and the AI; it can comment but never approve or decide |
| `content.draft` | `get_language_catalog`, `propose_language_file` | Propose a language file for a site; a person reviews and applies it, and nothing is shown to visitors until then |
| `blogai.read` | about twenty `blogai_*` tools | Read-only research over a legacy BlogEngine database, for a migration. These are the MCP server's own tools (they never reach the API), and tests keep them read-only |

`tools/list` shows a caller only the tools its scopes allow, and `tools/call` checks the scope again for the tool being called (a token without the scope gets a tool error and nothing is forwarded). There is deliberately **no publish tool**: an administrator reviews a draft and publishes it in the admin, and the API itself refuses to publish through the authoring surface, whatever a client asks for. Defence in depth: the tool list, the call check, the API scope policy, and the business rule all say the same thing.

### Changing a published post: a revision, not an edit

The authoring tools cannot touch a published post, so how does an assistant keep a Help post current? `propose_revision` creates a **hidden draft copy** of the published post that carries only the changes (everything else carries over, and the published address never changes), marked as a revision of it. Readers keep seeing the published text; asking again updates the same revision; an administrator opens it in the admin and presses **Apply revision** (or **Discard revision**). The assistant proposes, a human approves: the same drafts-only rule, applied to updates.

## The machine identity

The client does not log in as a person. It is an **M2M client** (`claude-diagnostics`, `claude-author`, `claude-research`) with its allowed scopes; its secret is supplied by the host's environment (`ClientSecret__ClaudeAuthor` and its siblings), never committed. The client exchanges `{ clientId, clientSecret, scope }` at `POST /api/auth/m2m/token` for a short-lived JWT. Both the API and the MCP server validate the **same issuer and signing key**, so a token minted by one is accepted by the other, and a scope policy is the only gate on each route. A client with no secret configured is simply inactive.

On a developer machine the secret lives in the OS credential store and is injected into one child process, so neither a person's shell history nor an AI's context ever sees it. That is how the helper scripts in the repository run.

## The two sites find each other with two settings

The API needs the MCP site's address and the MCP site needs the API's. Set your domain once (`Site__Domain`) and they become `https://mcp.<domain>/` and `https://api.<domain>/`. On a fresh install with no domain, set `McpServer__BaseUrl` on the API site and `Api__BaseUrl` on the MCP site instead, for example to each site's free temporary address; the install guide walks through it. The API also calls the MCP site's `/api/hello` as a live health check, and the MCP site fetches the tool manifest from the API, so both directions are exercised by normal use.

## Observability comes with it

Every request carries a **correlation id** (a header the browser, the API and the MCP server pass along). `diagnose_request` takes that id and returns the exceptions recorded for it, the kinds of failure they belong to, and the log lines of that request. This is what lets an AI assistant answer "what happened to the request that failed at 14:02?" with evidence instead of guesses.

## What to reuse in your own organisation

1. **The transport and the three methods** (`initialize`, `tools/list`, `tools/call`): a few hundred lines, no SDK required.
2. **Declare each tool once, as data with its scope and route**, publish the list from your API, and let the MCP server read it. Filter by scope and check the scope again on every call.
3. **Forward to your existing API with the caller's token** instead of re-implementing logic; keep authorisation in one place.
4. **Make dangerous capabilities absent, not just guarded**: no publish tool, no delete tool. Prefer a tool that can only draft over a tool that can do everything and is asked nicely.
5. **Give the assistant its own identity** with the narrowest scopes it needs, and make that identity inactive until a human supplies its secret.
6. **Return refusals as tool errors** with the reason in plain words.

## Where to look

- `Adventures.Foundation/src/Adventures.Tools` and `Adventures.Tools.WebApi`: the tool contract and `GET /api/tools`.
- The tool declarations sit beside their controllers in `Adventures.Diagnostics.WebApi`, `Adventures.Blog.WebApi` and `Adventures.Collaboration.WebApi` (the `Tools` folders).
- `src/McpServer.WebApi/Controllers/McpController.cs`: the protocol, the manifest cache and the forwarding; `src/McpServer.WebApi/Tools` holds the MCP-only research tools.
- `Adventures.Foundation/src/Adventures.Blog/Content/ContentAuthoring.cs`: the drafts-only rules.
- `test/McpServer.WebApi.Tests`: the behaviour, as executable examples.
