---
title: Getting around the admin - pages, posts, categories and tags
description: A short guide to the admin area - the menu, writing and publishing a post, building a page tree, and what you cannot change by accident.
categories: Help
tags: Admin, Posts, Pages, Categories, Tags
comments: true
---

This is the how-to for the admin area. Sign in, open the account menu and choose **Admin**.

## The menu

The menu on the left is not hard-coded: the server sends it, filtered by your roles. Items for screens that are not built yet are listed dimmed with "soon", so you can see where the project is heading. **Exceptions** carries a red count when something needs a look.

## Posts

**Content > Posts > New.** Give the post a title and write the body in **Markdown**; the **Preview** button shows it rendered. Tick the categories and tags that apply (create new ones on their own screens first, or let an author tool create them by name). **Save**: the post opens as a **draft** with a slug made from the title, a date, and you as the author.

Publishing is deliberate. A saved post shows a **Publish** button (and **Unpublish** once it is public). The publish state is not an editable field: no form can flip it by accident, and drafts written by other people or tools stay drafts until an administrator publishes them here.

## Pages

**Content > Pages** works the same way, with a tree. Choose a **Parent** to put a page under another, and **Sort order** to order siblings. Rules enforced for you: a page cannot be its own parent or move under one of its own sub-pages, and only one page is the **front page** (setting it on one clears the others). **Show in list** controls whether the page appears in the site menu.

## Categories and tags

Both are simple lists with a name. A post can have several of each. Use categories for the kind of post (Help, Development log) and tags for what it is about (Pages, Roles, MCP).

## Revisions: keeping a published post current

Published posts are not edited by tools. When Claude (or another author tool) wants to change a published post it proposes a **revision**: a hidden draft copy with the changes. In **Admin > Posts** a revision shows its original in the **Revision of** column. Open it and use **Apply revision** to copy its title, content, description, categories and tags onto the published post (the address and date stay the same, and the revision disappears), or **Discard revision** to throw it away. A revision cannot be published on its own.

## Users and roles

**Users > Users** lists accounts; open one to see its role assignments and add or remove them. A tenant always keeps at least one administrator, so removing the last one is refused with the reason.

## When something looks wrong

Every error message shows a reference. **Exceptions** lists what the server recorded; **Diagnose** on an entry explains it, and **Ask Claude** gets a second opinion from an AI using a scrubbed copy of the report.
