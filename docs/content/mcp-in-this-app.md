---
title: The MCP server in this app, end to end
description: How the Model Context Protocol server works here - the wire protocol, how a tool is declared and forwarded, how scopes protect it, and what to reuse in your own organisation.
categories: MCP, Development log
tags: MCP, Diagnostics, Authoring, Security
comments: true
---

This post explains the one piece of this project that most teams ask about first: the **MCP server**. It is small on purpose, and everything below is in the repository, so you can read the code while you read this.

## What MCP is, in one paragraph

The Model Context Protocol lets an AI client discover and call **tools** on a server. The client does not need to know your REST routes; it asks the server what tools exist, reads their descriptions and input schemas, and calls them. On the wire it is plain JSON-RPC 2.0: one HTTP `POST` endpoint, a handful of methods. Our server answers with ordinary JSON, which the "streamable HTTP" transport allows.

## The conversation

Every session is the same three calls (`POST https://mcp.global-webnet.com/mcp`, with a bearer token):

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

## A tool is a declaration plus a forward

In `McpServer.WebApi/Controllers/McpController.cs` each tool is a name, a description written for a model, a JSON-schema for its arguments, and the **scope** that unlocks it. A call does not run logic in the MCP server: it **forwards** one request to the API with the caller's own token (`DiagnosticsApiClient`) and returns the API's answer text. That choice matters:

- The API stays the single place that decides what is allowed. The MCP server cannot do anything the caller could not do by calling the API directly.
- A new tool is a few lines: declare it, map it to a route.
- Everything is testable without an AI: the tests in `McpServer.WebApi.Tests` post JSON-RPC and assert the forwarded request.

## Two groups of tools, two scopes

| Scope | Tools | What they can do |
|---|---|---|
| `mcp.diagnostics.read` | `diagnose_request`, `recent_exceptions`, `exception_signatures` | Read-only: find what went wrong for a request by its correlation id |
| `content.draft` | `list_my_posts`, `create_draft_post`, `update_draft_post`, `propose_revision`, `list_categories`, `list_tags`, `create_category`, `create_tag` | Write **drafts** only, under one fixed author account |

`tools/list` shows a caller only the tools its scopes allow, and `tools/call` checks the scope again for the tool being called (a token without the scope gets a tool error and nothing is forwarded). There is deliberately **no publish tool**: an administrator reviews a draft and publishes it in the admin, and the API itself refuses to publish through the authoring surface, whatever a client asks for. Defence in depth: the tool list, the call check, the API scope policy, and the business rule all say the same thing.

### Changing a published post: a revision, not an edit

The authoring tools cannot touch a published post, so how does an assistant keep a Help post current? `propose_revision` creates a **hidden draft copy** of the published post that carries only the changes (everything else carries over, and the published address never changes), marked as a revision of it. Readers keep seeing the published text; asking again updates the same revision; an administrator opens it in the admin and presses **Apply revision** (or **Discard revision**). The assistant proposes, a human approves: the same drafts-only rule, applied to updates.

## The machine identity

The client does not log in as a person. It is an **M2M client** (`claude-diagnostics`, `claude-author`) declared in the API's `appsettings.json` with its allowed scopes; its secret is supplied by the environment, never committed. The client exchanges `{ clientId, clientSecret, scope }` at `POST /api/auth/m2m/token` for a short-lived JWT. Both the API and the MCP server validate the **same issuer and signing key**, so a token minted by one is accepted by the other, and a scope policy (`Scope:content.draft`) is the only gate on each route. A client with no secret configured is simply inactive.

On a developer machine the secret lives in the OS credential store and is injected into one child process, so neither a person's shell history nor an AI's context ever sees it. That is how the helper scripts in the repository run.

## Observability comes with it

Every request carries a **correlation id** (a header the browser, the API and the MCP server pass along). `diagnose_request` takes that id and returns the exceptions recorded for it, the kinds of failure they belong to, and the log lines of that request. This is what lets an AI assistant answer "what happened to the request that failed at 14:02?" with evidence instead of guesses.

## What to reuse in your own organisation

1. **The transport and the three methods** (`initialize`, `tools/list`, `tools/call`): about 200 lines, no SDK required.
2. **Declare tools with their scope** and let `tools/list` filter by scope; check the scope again on every call.
3. **Forward to your existing API with the caller's token** instead of re-implementing logic; keep authorisation in one place.
4. **Make dangerous capabilities absent, not just guarded**: no publish tool, no delete tool. Prefer a tool that can only draft over a tool that can do everything and is asked nicely.
5. **Give the assistant its own identity** with the narrowest scopes it needs, and make that identity inactive until a human supplies its secret.
6. **Return refusals as tool errors** with the reason in plain words.

## Where to look

- `src/McpServer.WebApi/Controllers/McpController.cs`: the protocol and the tools.
- `src/McpServer.WebApi/DiagnosticsApiClient.cs`: the forwarding.
- `src/AiBlogResearch.WebApi/Controllers/AuthoringController.cs` and `AdminDiagnosticsController.cs`: the API surfaces the tools call.
- `Adventures.Foundation/src/Adventures.Entities/ContentAuthoring.cs`: the drafts-only rules.
- `test/McpServer.WebApi.Tests/Controllers/McpControllerTests.cs`: the behaviour, as executable examples.
