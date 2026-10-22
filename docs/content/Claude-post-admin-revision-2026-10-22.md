---
title: Getting around the admin - pages, posts, categories and tags
description: A short guide to the admin area - the menu, writing and publishing a post, the icons and shortcuts, building a page tree, and what you cannot change by accident.
tags: Admin, Posts, Pages, Categories, Tags, Usability
---

This is the how-to for the admin area. Sign in, open the account menu and choose **Admin**.

## Icons and where to find them

Buttons in the admin are icons with the name shown when you hover over them (a screen reader announces the same text). Action icons sit at the **right**, like the sign-in icons in the header. In an editor the bar stays at the top and follows you while you scroll a long form: back to the list, **Save** (disk), the actions of that entry (**Publish** or **Unpublish**, **Apply revision**, **Discard revision**) and **Delete** (bin). In a list, **+** creates a new entry, and the page-turn icon on an expanded row opens it.

## The menu

The menu on the left is not hard-coded: the server sends it, filtered by your roles. Items for screens that are not built yet are listed dimmed with "soon", so you can see where the project is heading. **Exceptions** carries a red count when something needs a look.

## Posts

**Content > Posts > +.** Give the post a title and write the body in **Markdown**; the **Preview** button shows it rendered. Tick the categories and tags that apply (create new ones on their own screens first, or let an author tool create them by name). **Save**: the post opens as a **draft** with a slug made from the title, a date, and you as the author.

Publishing is deliberate and one click. In the list, the **Published** column is a switch: flip it to publish or unpublish without opening the post. In the editor the same thing is the eye icon. The publish state is not an editable field: no form can flip it by accident, and drafts written by other people or tools stay drafts until an administrator publishes them.

## Editing from the site

When you are signed in, every published post and page shows three icons at the right of its title line: **add**, **edit** and **delete**. Edit opens the entry in the admin, add opens a new one, and delete asks first. Visitors never see them.

## Pages

**Content > Pages** works the same way, with a tree and the same Published switch in the list. Choose a **Parent** to put a page under another, and **Sort order** to order siblings. Rules enforced for you: a page cannot be its own parent or move under one of its own sub-pages, and only one page is the **front page** (setting it on one clears the others). **Show in list** controls whether the page appears in the site menu. Until a front page is set the site has no **Home** link and opens on the posts, as BlogEngine.NET did.

## Categories and tags

Both are simple lists with a name. A post can have several of each. Use categories for the kind of post (Help, Development log) and tags for what it is about (Pages, Roles, MCP).

## Revisions: keeping a published post current

Published posts are not edited by tools. When Claude (or another author tool) wants to change a published post it proposes a **revision**: a hidden draft copy with the changes. In **Admin > Posts** a revision shows its original in the **Revision of** column. Open it and use **Apply revision** (check icon) to copy its title, content, description, categories and tags onto the published post (the address and date stay the same, and the revision disappears), or **Discard revision** (cancel icon) to throw it away. A revision cannot be published on its own. This is also how review summaries are exchanged: the summary arrives as a draft or a revision, and you decide in the admin.

## Users and roles

**Users > Users** lists accounts; open one to see its role assignments and add or remove them. A tenant always keeps at least one administrator, so removing the last one is refused with the reason.

## When something looks wrong

Every error message shows a reference. **Exceptions** lists what the server recorded, newest occurrences first, with the grouped kinds of failure below. **Diagnose** (stethoscope) on an entry explains it, and **Ask Claude** gets a second opinion from an AI using a scrubbed copy of the report.
