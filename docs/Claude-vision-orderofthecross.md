# Vision: orderofthecross.net, the research side of collaboration (2026-10-25)

Source: the human's closing note of 2026-10-25. Status: vision only. Developer collaboration comes first; this work may not make the beta.

## Purpose

`orderofthecross.net` is the domain where the research half of the platform is worked out as developer collaboration is finished. It is also the end-to-end SmarterASP setup test bed: standing it up from scratch is the proof for the install guide (the beta gate).

## Audience and material

- **Audience:** priests (and then laity, study groups) researching uploaded material for homilies, teaching sessions and personal study.
- **Corpus:** Catholic public-domain works (the saints, the Doctors of the Church), public-domain Bibles (the human has a folder of them waiting), and other authoritative sources.

## Principles

- **The truth vets the priest.** Contradicting information is flagged beside the claim. The author either addresses the contradiction or accepts that readers see the flag; uploading supporting documentation clears it.
- **Private or public blog.** A researcher keeps their blog private or publishes it so others can subscribe to uploads and posts.
- **Subscriptions pull in material.** Users follow public authors, priests, laity and study groups; subscribed authors' research flows into their own searches.

## Mapping to the platform

- Reuses the developer-collaboration stack: comments, review items, rights (S1/S2 roles), tenant by domain (one app, many domains, the host picks the tenant), and the MCP seams.
- New for this side: a source corpus with authority levels, contradiction flagging with supporting-document clearing, and the subscription graph. The human names MEF tools and providers such as DCI as the place this lands; details come when the stage starts.

## Decisions pending

- Tenant data scoping (needed before a second domain holds its own data).
- Which side of the public/private line the research features sit (see `Claude-decision-2026-10-protect-and-help.md`).
- Corpus licensing check per source before upload (public domain by edition, not just by author; translations and critical editions can be copyrighted).
