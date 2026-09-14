You didn't fully misunderstand — there's a real feature behind that statement — but it's being oversimplified in a way that blurs three genuinely different things. Let me separate them precisely, and there's good news for your stack while I'm at it.

## Three distinct layers, often conflated

**1. The base Anthropic SDK** — a thin, official client for the Messages API: send a prompt, get a completion, stream it, pass tool definitions, get multimodal input. It's the equivalent of an HTTP client wrapper. This is *not* orchestration on its own.

**2. The MCP connector — a real built-in feature of the Messages API itself**, not a separate SDK. You can pass an `mcp_servers` parameter directly in your Messages API call, and Claude will call tools on a *remote* MCP server for you, entirely server-side — no separate MCP client library needed. This is almost certainly what generated the "you basically get Claude functionality with the Anthropic SDK" claim, and for this specific case (remote, URL-reachable MCP servers, tools only) it's literally true: the base SDK plus this one parameter is all you need.

**3. The Claude Agent SDK** — a separate, higher-level package that wraps the base SDK and adds the actual autonomous agent loop: built-in tools, permission gating, MCP client support (including *local* servers), hooks, subagents, provider routing. This is the real orchestration layer — and it's the one confirmed **Python/TypeScript only**, not C#.

So: not "the Anthropic SDK has orchestration built in" generally — more precisely, "the API has one specific orchestration-adjacent shortcut built in (remote MCP tool-calling), and the *real* orchestration engine (Agent SDK) is a different, separate product that doesn't reach C#."

## New fact that matters for your decision: Anthropic now ships an official C# SDK too

`anthropics/anthropic-sdk-csharp` (NuGet package `Anthropic`) is Anthropic's own first-party C# client, not a community port — it existed only as unofficial community packages (tryAGI, Cysharp/Claudia) until this. That's a meaningful strengthening of your stack: you can call Claude's Messages API from C# with first-party support, use the `mcp_servers` connector for simple remote-tool cases without touching the MCP SDK at all, and drop into the full MCP C# SDK when you need local servers or more control.

## Where this leaves your Python question

Combining what we've now confirmed: **Anthropic C# SDK** (API calls + remote MCP connector) + **MCP C# SDK** (local servers, full control) + **Microsoft Agent Framework** (the actual multi-step agent loop / multi-agent orchestration, C#-native) genuinely covers everything except one specific thing: the packaged, drop-in "give me Claude Code's entire agent loop in one `query()` call" experience that the Agent SDK provides. That exact convenience is Python/TypeScript-only. You could build an equivalent loop yourself in C# using MAF + the Anthropic C# SDK + MCP C# SDK — it's not blocked, just not a single pre-built package the way it is in those two languages.

For your Angular + C# Web API project, that gap is unlikely to matter — you're building your own application logic around Claude calls and MCP tools, not trying to re-host Claude Code itself. Python remains non-moot only if you specifically want that pre-packaged autonomous-agent-loop product.

Sources:

- [MCP connector — Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [GitHub - anthropics/anthropic-sdk-csharp](https://github.com/anthropics/anthropic-sdk-csharp)
- [Claude Agent SDK Complete Guide](https://hidekazu-konishi.com/entry/claude_agent_sdk_complete_guide.html)
- [The Claude Developer Guide — MCP in the API](https://blog.gopenai.com/the-claude-developer-guide-mcp-in-the-api-d2f1461313fe)



Let's unpack a couple of things.

1. The Agent SDK is Python/Typescript only
2. From this context, it seems that AI orchestration is required - even if at a minimal level.

Angular being client-side, written in Typescript. I suspect that Python/Typescript for Agent SDK is server side so is it feasible to run an Angular server side TypeScript service that can integrate naturally with Anthropic Agent SDK.

For my purpose, I envision an MCP Host that has tools to access my resources (filesystem, database, etc). My ai-blog-research Web Api will do searches using this MCP host - the searches will be File uploads, blogs, and database content if/as applicable. Would be nice if I could stick to Anthropic's MCP SDK, but I'll bend to the Microsoft Agent Framework - although the name itself suggests to me it's lifespan will be limited.

Good unpacking — let's take these one at a time, because there's a language/runtime conflation worth untangling and a terminology correction that'll help your design.

## 1 & 2: Confirmed and agreed

Agent SDK is Python/TypeScript-only, and yes — some minimum orchestration layer is unavoidable. Even the MCP connector's "one-shot remote tool call" isn't enough for what you're describing (multi-source search across files/blogs/db, presumably with follow-up reasoning over results).

## 3: "Angular server-side TypeScript" — feasible, but it's not Angular running server-side

Important distinction: Angular is a *browser* UI framework — it compiles to a bundle that runs in the user's browser. What you'd actually run server-side is a **separate Node.js service**, written in TypeScript, that happens to share a language with Angular but shares nothing else — different runtime (Node vs. browser V8), different purpose, likely a different codebase/repo entirely (e.g., a small NestJS or Express service). It would never be part of your Angular app's compiled output — the Agent SDK needs your API key, filesystem access, and process spawning, none of which can safely exist in browser-delivered code.

So yes, it's fully feasible: **Angular (browser) → C# Web API (or directly → a Node/TS microservice) → Node/TS service running Claude Agent SDK.** That's a real, working architecture. The question is whether it's the *right* one for you, given you'd now be running three languages/runtimes (TS in the browser, C# for your main API, TS again in Node for just the agent piece) instead of two.

## Terminology correction, since it clarifies your own design

What you're describing — *"an MCP Host that has tools to access my resources"* — inverts the MCP roles slightly. In MCP's vocabulary:

- **MCP Host** = the application that embeds the LLM client and *consumes* tools (this would be your `ai-blog-research` Web API).
- **MCP Server(s)** = separate components that *expose* tools/resources — e.g., a filesystem server, a database server, a custom blog-search server.

So your actual design is: **your Web API is the MCP Host**, and it connects out to one or more **MCP servers** (filesystem, database, blog-content search) that expose the tools it calls. Useful to have precise, since it maps directly onto SDK docs and examples going forward.

## The actual architecture question: is a second (Node/TS) service worth it here?

Here's the honest technical read, not just deference to your comfort zone: **Claude Agent SDK's distinguishing features are built for autonomous *coding* agents** — permission gating on shell/file-write operations, subagents for parallel coding tasks, hooks tuned for a coding workflow (it's literally what runs Claude Code). Your use case — search over file uploads, blog content, and database rows, then reason over results — is a standard **retrieval/tool-calling agent**, not a coding agent. You're not really leaving value on the table by not using Agent SDK specifically; MAF's agent abstractions (tool-calling loops, multi-step reasoning, multi-agent workflows if you ever need them) cover this pattern natively and are a good technical fit, not just a fallback.

Given that, plus your proven, demonstrated .NET depth (the 4.7→8→10 migration is real evidence, not just comfort), I'd recommend staying single-stack: **ASP.NET Core Web API (the MCP Host) + MCP C# SDK (client, to talk to your filesystem/db/blog MCP servers) + MAF (the agent loop/tool-orchestration logic) + the official Anthropic C# SDK (the actual Claude calls)** — all in C#, one runtime, one deployment surface, one set of ops concerns. A second Node/TS service buys you Agent SDK's coding-agent conveniences you don't need, at the cost of running and securing a second runtime with its own auth boundary to your main API.

## On the name "Microsoft Agent Framework" signaling a short lifespan

Fair instinct, and consistent with your framework — but worth one correction: MAF isn't a fresh v0 experiment, it's the **convergence point** of two already-mature, multi-year projects (Semantic Kernel and AutoGen) that Microsoft merged and shipped as 1.0 GA. That's a different risk profile than a brand-new named product. And structurally, it's protected the same way Angular and Semantic Kernel are: it's a library you call, not a backend service Microsoft could throttle or cut off — worst case if Microsoft loses interest is what already happened to Semantic Kernel itself: it goes into maintenance mode (security/bug fixes only) while your existing code keeps running unchanged. That's a real but bounded downside, not a Gemini-CLI-style cutoff.

Want me to sketch the concrete C# project structure — the MCP Host (Web API), the MCP server(s) for filesystem/db, and where MAF's agent loop sits between them — so you can see the shape before writing any code?



That would be perfect. It has been a numerous month journey, but a necessary one - I have come full cycle and must admit I am relieved that it lands where I am most comfortable. You played devils advocate very strongly and I am confident that you are not just playing to my strengths - but are genuine in your reasoning that this is a solid path forward. Armed with everything I have learned, I feel I am now better equipped to start this development adventure with you.



Glad it landed somewhere solid rather than just comfortable — and for what it's worth, the pushback was genuine: Blazor and Gemini CLI failed your test on the evidence, Angular and this C#/MAF stack didn't. Comfort and correctness happened to line up this time; they wouldn't have if the evidence had gone the other way. Here's the shape.

## High-level flow

```
┌─────────────┐        HTTPS/REST        ┌──────────────────────────┐
│   Angular   │ ───────────────────────► │   AiBlogResearch.WebApi  │
│  (browser)  │ ◄─────────────────────── │      (the MCP Host)      │
└─────────────┘                          └────────────┬─────────────┘
                                                      │
                                          orchestrates via MAF
                                                      │
                          ┌───────────────────────────┼────────────────────────────┐
                          ▼                           ▼                            ▼
                ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
                │ Anthropic C# SDK │        │ MCP C# SDK       │        │ MCP C# SDK       │
                │ (calls Claude)   │        │ (client → server)│        │ (client → server)│
                └──────────────────┘        └────────┬─────────┘        └────────┬─────────┘
                                                     ▼                           ▼
                                          ┌──────────────────────┐   ┌──────────────────────┐
                                          │ McpServer.FileSearch │   │ McpServer.Database   │
                                          │ (uploads, blog files)│   │ (query blog content) │
                                          └──────────────────────┘   └──────────────────────┘
```

Angular never talks to MCP or Claude directly — it only ever calls your own Web API's endpoints. Everything agentic happens behind that boundary.

## Solution structure

```
AiBlogResearch.sln
├── src/
│   ├── AiBlogResearch.WebApi/            ← the MCP Host (ASP.NET Core)
│   │   ├── Controllers/SearchController.cs
│   │   ├── Agents/ResearchAgent.cs        ← MAF agent definition + tool wiring
│   │   ├── McpClients/                    ← MCP C# SDK client registrations
│   │   └── Program.cs
│   │
│   ├── McpServer.FileSearch/              ← standalone MCP server (ASP.NET Core minimal API)
│   │   ├── Tools/SearchUploadedFiles.cs
│   │   ├── Tools/SearchBlogPosts.cs
│   │   └── Program.cs
│   │
│   └── McpServer.Database/                ← standalone MCP server
│       ├── Tools/QueryBlogDatabase.cs
│       └── Program.cs
│
└── client/
    └── ai-blog-research-ui/               ← your existing/new Angular app
```

**Why the MCP servers are separate projects, not just classes inside the Web API:** each one gets its own process, its own credentials (the database server holds the DB connection string; the file server holds filesystem/blob access — neither needs the other's secrets), and its own scaling/security boundary. They talk to the Host over the new **stateless HTTP transport** (2026-07-28 spec) — no session state, easy to deploy as small independent services or even serverless functions later if you want.

## What each piece actually does

- **`AiBlogResearch.WebApi`** — your public-facing API. Receives a search request from Angular, hands it to a MAF agent. This is the MCP *Host*.
- **MAF agent (`ResearchAgent`)** — owns the loop: takes the user's query, decides which tool(s) to call (file search vs. DB query vs. both), calls them via the MCP C# SDK clients, feeds results back to Claude via the Anthropic C# SDK, and returns a synthesized answer.
- **`McpServer.FileSearch`** — exposes tools like `SearchUploadedFiles` and `SearchBlogPosts` over your file storage.
- **`McpServer.Database`** — exposes tools like `QueryBlogDatabase` over your actual DB (parameterized, scoped — the agent never gets raw SQL access, only the specific tool calls you define).
- **Anthropic C# SDK** — the only thing that actually talks to Claude.

## Request walkthrough

1. User types a research question in Angular.
2. Angular `POST`s it to `AiBlogResearch.WebApi`'s `/search` endpoint.
3. The Host's `ResearchAgent` (MAF) starts a loop: sends the query + available tool definitions to Claude via the Anthropic SDK.
4. Claude responds "call `SearchBlogPosts` with these terms" → MAF routes that through the MCP C# SDK client to `McpServer.FileSearch`.
5. Tool result comes back → MAF feeds it to Claude again → Claude either asks for another tool call (e.g., now query the database) or produces a final answer.
6. Final answer flows back through the Web API to Angular.

This is a clean, single-language, foundation-and-first-party-backed stack end to end — nothing here depends on Python, and nothing here depends on a single vendor's backend service staying alive.

Want me to start scaffolding this — solution file, the three projects, and a minimal working `SearchBlogPosts` tool wired end-to-end — so you have something real to run and build on?


