---
title: Install your own copy on SmarterASP.NET - one site, three sites, or your own domain
description: Three ways to run this blog on a shared SmarterASP.NET hosting plan, from one site on its free temporary address to a full set with your own domain, what each needs, and the traps the first real installs found.
categories: Help
tags: Install, SmarterASP, Hosting, SSL, Setup
comments: true
---

This blog is meant to be cheap to run. This post is the short version of the install guide in the repository ([docs/Claude-install-guide-smarterasp.md](https://github.com/BillKrat/ai-research-blog/blob/main/docs/Claude-install-guide-smarterasp.md)): which layout to pick, what each needs, and what went wrong on the first real installs.

## What it costs, and who charges it

We do not provide hosting or AI services. You pay the other parties directly: shared Windows hosting from [SmarterASP.NET](https://www.smarterasp.net) (about $38 per quarter on the plan this project runs on) and, if you want an AI assistant, a subscription from the provider of your choice (about $20 a month). The free HTTPS certificates SmarterASP.NET gives each site are enough for everything below, so the certificate is not a cost.

## Pick a layout

| Layout | Sites you create | Addresses | Best for |
|---|---|---|---|
| **One site** | 1 | the site's own temporary address | Trying it, or a single blog. The API serves the client, so there is one address and one certificate. |
| **Three sites on temporary addresses** | 3 (web, API, MCP) | three temporary addresses, each with its free certificate | The full layout with nothing to buy and no domain. You can attach your own domain to the web site later. |
| **Your own domain** | 3 | `www`, `api.` and `mcp.` under your domain | A real site. Each name needs its own free certificate. |

Every SmarterASP.NET site answers on a temporary address (it looks like `account-siteN.dtempurl.com`) before you attach any domain, and the panel shows a free certificate on it. The first two layouts use that.

## What every layout needs

1. **A PostgreSQL database** on the plan. Its host answers on port **6432** (the template in the panel says 5432; 5432 times out). Use a simple password while installing.
2. **Two site settings on the API's application pool:** `ConnectionStrings__Postgres` and `Jwt__SigningKey` (a long random value; generate it, do not invent it). Without either the API stops at start and answers 503 "configuration incomplete"; the reason is in `logs/startup-*.log` on the site. Check the signing key box is not blank after you paste it: an empty value looks set in the panel.
3. **An FTP user per site.** The deploy uploads the files and never overwrites a live site's settings.
4. **The first request creates the first site.** On an empty database the first host that answers becomes the first site, with an administrator `Admin` and the password `Admin`, which the app makes you change at your first sign-in.

## One site

Create one site, set the pool settings above, set the GitHub repository variable `DEPLOY_MODE` to `single`, and run the **Deploy single site** workflow. (Honest status: this layout was proved on a real second host with a locally built upload; the workflow itself has not been run end to end yet, so watch its first run.) Open the temporary address; you are in. Add a domain later by binding it to the same site and registering it on the site in Admin > Tenants.

## Three sites on temporary addresses

Create a web site, an API site and an MCP site, and give each its pool. Then tell the pieces where to find each other:

| Where | Setting | Value |
|---|---|---|
| Deploy (GitHub variable) | `API_URL` | the API site's temporary address, `https://...` |
| API pool | `McpServer__BaseUrl` | the MCP site's temporary address, with a trailing slash |
| MCP pool | `Api__BaseUrl` | the API site's temporary address, with a trailing slash |
| API and MCP pools | `Jwt__SigningKey` | **the same value** on both |

Leave `Site__Domain` unset: when it is set it replaces both addresses with `api.` and `mcp.` names. The web site is plain files, so it needs no settings at all, but it does need a `web.config` that rewrites unknown paths to `index.html` so a refresh on a deep link works.

The API serves only hosts that belong to a tenant. For the first run, set `Tenancy__AutoAliasToTenantDomain` on the API pool to the web site's host name, open the API's temporary address once, and the log says the host "was added as an alias". Then remove the setting. This layout has been proved end to end on a second host: sign-in, edits, and the API and MCP sites calling each other.

## Adding your own domain to the web site

Bind the domain (and `www`) to the web site; SmarterASP.NET serves it over https with its own free certificate. The page loads, but the API refuses calls from a name no tenant owns, so it shows "The API isn't answering". Sign in on the temporary address as a platform administrator, open **Admin > Tenants**, add the domain as a host name of the site and save. It works at once. You do not need `api.` or `mcp.` names or certificates first.

## Traps worth knowing

- **Edit the right pool.** A pool has a name you can change and each site belongs to exactly one. Set variables on the pool that lists your site, then restart it; a failed start stays failed until the pool restarts.
- **Replacing files on a running site:** the app holds its files open. Upload `app_offline.htm` first, replace the files, then delete it (the deploy workflows do exactly this).
- **A free certificate needs the name to resolve straight to your server** (a plain record, no CDN in front) and the site root to answer. A CDN in its default mode encrypts only to the visitor and then talks plain HTTP to your server, which breaks sign-in; use a mode that encrypts to the server.
- **The plan's free-certificate allowance can run out.** If a request is not queued, look at the SSL page in the panel before you move DNS.
- **Read the logs first.** `logs/` on the site holds `stdout_*.log`, `startup-*.log` and then `webapi-*.log` once it runs.
- **After a deploy, a tab left open on the old version may fail to load a page once.** The client reloads itself once when that happens.

When it is up, [Getting around the admin](/post/getting-around-the-admin-pages-posts-categories-and-tags) walks through the screens, and the repository's README lists everything it does.
