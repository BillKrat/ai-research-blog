---
title: Getting around the admin - pages, posts, categories and tags
description: A guide to the admin area as it is today - the menu and Dashboard, writing and publishing posts and pages, comments, users and rights, settings, plug-ins, widgets, languages and tenants, and how to find out what went wrong.
categories: Help
tags: Admin, Posts, Pages, Categories, Tags, Comments, Settings
comments: true
---

This is the how-to for the admin area. Sign in, open the account menu and choose **Admin**. The first time you sign in with a starter account you are taken to your **Profile** and asked to change the password before anything else works; that is deliberate.

## The menu and the Dashboard

The menu on the left is not hard-coded: the server sends it, filtered by **your rights**, so you only see screens you can use. It collapses to icons (hover for the name), and counters show what waits: **Exceptions** for new problems, **Comments** for comments awaiting approval, **Collaboration** for items waiting for your review.

**Dashboard** is the home screen: counts of posts, pages and comments, what is waiting for you, your drafts, the health of the site, a **Quick draft** box and the latest comments. If you manage several sites, it also shows which site you are working in.

## Posts

**Content > Posts > New.** The form leads with **Title** and **Content**. Pick the **format**: **Html** for the Word-like document editor (toolbar, pictures, tables), or **Markdown** with a visual editor and a Markdown view, and a **Preview** that renders it, including Mermaid diagrams. Posts written by an AI tool are Markdown; posts you write in the document editor are HTML, and HTML is cleaned (sanitised) when it is saved and again when it is served. Tick the categories and tags, add a picture with the image button, and **Save**.

A saved post is a **draft** with an address made from its title. **Publish** and **Unpublish** are buttons, not a field, so no form can flip them by accident, and drafts written by tools stay drafts until you publish them. Each post also has its own **comments** switch.

## Pages

**Content > Pages** works the same way, as a tree. Choose a **Parent** to put a page under another and a **Sort order** for siblings. A page cannot be its own parent or sit under its own sub-page, only one page is the **front page**, and **Show in list** decides whether it appears in the site menu. Publishing a page needs its own right (`pages.publish`), so an editor can draft pages without being able to publish them.

## Categories and tags

**Categories** are a simple list. **Tags** are a tag cloud of pills with counts: click a pill to list its posts, and use the pencil to rename. A post can have several of each; use categories for the kind of post and tags for what it is about.

## Comments

Visitors can comment on a post when comments are on (site-wide in **Settings**, and per post). New comments wait for approval. **Comments** lists them (filter by All, Waiting or Approved) with **Approve**, **Unapprove** and **Delete** for the ticked rows, and the menu counter tells you how many wait. Delete asks first. Existing comments are kept if you switch comments off.

## Collaboration and Decisions

**Collaboration** is the review channel between you and an AI assistant: items it files for your review, with a conversation, an **Approve** (with a note), **Change request**, and quick replies. **Decisions** lists every decision you recorded, with its date and the item it belongs to. How to use them is in the post on human and AI collaboration.

## Revisions: keeping a published post current

Published posts are not edited by tools. An AI tool proposes a **revision**: a hidden draft copy with the changes. In **Posts** a revision shows its original in the **Revision of** column. Open it and use **Apply revision** to copy its title, content, description, comments setting, categories and tags onto the published post (the address and date stay), or **Discard revision**. A revision cannot be published on its own.

## Users, roles and rights

**Users** lists accounts. **New** creates a person who can sign in (with a first password they must change). Open a person to see their role assignments, to add or remove them, to see whether their e-mail address is **confirmed**, and to send the confirmation mail again. **Roles** shows each role as a checklist of **rights**, listed alphabetically; every screen and every action in the admin asks for one exact right. A site always keeps at least one administrator, so removing the last one is refused with the reason.

## Settings, e-mail and Maintenance

**Settings** holds the site title and tagline, posts per page, **Dark or Light** colour mode, the language, the feed length, comment rules (on or off, whether they need approval, closing after some days) and a tracking-script address; any setting the site does not have yet is created for you. **E-mail** holds the mail server settings and a **test send**. **Maintenance** downloads a readable JSON backup of your posts, pages and drafts (no user names, passwords or secrets; it is a backup, not yet an import) and clears the caches.

## Plug-ins, widgets and languages

**Plugins** lists the features that can be switched on or off for this site (collaboration, decisions, HTML sanitising and any plug-in someone installed), with a **Customize** screen for the ones that have settings. **Widgets** places small boxes in the four zones around the page (header, footer, left and right; a phone shows only header and footer): a text box, a tag cloud and a category list are built in. **Languages** holds the language files that supply every label and hover text; an AI assistant can propose a new language file, and nothing it proposes is shown to visitors until you apply it.

## Several sites (Tenants)

One install can serve several sites. **Tenants** lists them, adds a new one, and manages the **host names** each one answers to (a real domain, `www`, or a temporary address). If you are a platform administrator you can switch which site you are working in; everyone else works in the sites they belong to.

## When something looks wrong

Every error message shows a reference. **Exceptions** groups what the server recorded into **kinds of failure** with a count (click a kind to see its occurrences, and tick **show history** to include old ones). On an entry, **Diagnose** explains it with live checks, **Ask Claude** sends a scrubbed copy of the report to an AI for a second opinion, and **Prompt Claude** gives you a ready-made prompt to paste into your own AI session.
