# ai-research-blog

AI Research Blog is an early-stage, open-source replacement for
[AdventuresOnTheEdge.net](https://AdventuresOnTheEdge.net), currently powered by a legacy private
[BlogEngine.NET fork](https://github.com/BillKrat/BlogAI). It is being built as an Angular and
ASP.NET Core application, with Aspire providing the local development composition.

## Current State

The foundation is running today: an Angular client is deployed at
[www.global-webnet.com](https://www.global-webnet.com), backed by the ASP.NET Core API at
[api.global-webnet.com](https://api.global-webnet.com/api/health). The application includes
health monitoring, JWT-based user authentication, and machine-to-machine client-credentials
support. Reusable identity, security, and PostgreSQL data-access capabilities live in the
separate `Adventures.Foundation` packages.

## Vision

The API will evolve into an MCP Host that coordinates AI-assisted research and authoring. It will
call a separate, consolidated MCP Server over scoped machine-to-machine authentication. That
server will load independently developed tool modules -- such as PostgreSQL, SQL Server, and file
search -- so each tool retains control of its own data access and credentials.

### Security Across MCP Components

The MCP Host and Server will trust each other through short-lived, scoped machine-to-machine
tokens. The Host authenticates as its own client identity, requests only the scopes required for a
tool operation, and sends the resulting bearer token to the MCP Server. The server validates the
token and scope before invoking a tool; database, file-system, and other sensitive credentials
remain within the tool server and are never passed through the Host or exposed to the client.

Over time, the product will provide a modern research and blogging experience, while the related
BlogAI vision explores reviewable, searchable development narratives for AI-assisted code changes.

![](assets/20260920_175710_solution-uml.jpg)

The following is a screenshot of the [AI research](https://app.xmind.com/ftOSfVNH?xid=qMtMXB9B) that will be used in design of MCP Host and Servers

![](assets/20260920_182633_rdd-ai-development.jpg)
