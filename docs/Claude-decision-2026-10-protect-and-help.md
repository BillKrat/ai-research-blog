# Decision: help small developers, protect the business (2026-10-25)

Context: the human closed a loophole in the BUSL grant online (one individual, under $100,000 gross annual revenue, under $100,000 outside funding, no Competing Offering) and brought an AI-search conversation about whether the licence constrains going private. This records what holds, what does not, and the plan. Not legal advice; the attorney review stays open.

## What the research got right

- Change Date is capped at four years per version. A longer date is not available under BUSL 1.1 (and the Covenants forbid editing the text).
- Each version has its own Change Date, so later versions restart the clock. The licensor is not bound by her own licence and can dual-license, sell commercial licences, or ship a private fork.
- The CLA is what makes a private fork safe: without it a contributor's code could not be relicensed.

## What it got wrong or glossed over

1. **"Start private to be safe" is a false choice.** Nothing already published can be recalled. Versions before 2026-10-24 (early NuGet packages and source) are MIT for whoever holds them. Unlisting on nuget.org stops new downloads, not existing rights.
2. **The "secret sauce" lives in the public repo today.** The seed data, schema IRIs, rights catalog and shape interpreter are in `ai-research-blog` and `Adventures.Foundation`. The AI's advice to keep the canonical ontologies and role filters private is sound for the future, but is a split of what ships next, not a protection of what is out.
3. **"Obfuscate the Angular parser" is not a defence.** Client code is readable by definition; the licence and the server are the protection.
4. **The grant now has teeth that may bite the human.** Headcount "no more than one individual" applies to anyone using the work in production, not to the licensor. It also excludes a single hired contractor or a two-person start-up, which is the stated audience. Decide whether that is the intent (see plan, item 3).
5. **AGPL as Change License:** the BUSL covenants require a GPL-2.0-or-later-compatible Change License. AGPL-3.0 is commonly used, but it is the attorney's call.
6. **The "$38 a quarter" hosting cost and tool prices in the conversation** are the human's own figures, not verified here.

## Why the funnel is real

- The grant is narrow (one person, under $100k, not a hosted platform), so a funded competitor needs a commercial licence from day one.
- A competitor must wait for 2030-10-24 for the 2026 baseline; by then the live product is four years ahead.
- The server-side rights model (S1/S2) means a cloned client without the server's data and roles is an empty shell.

## Plan

1. **Done on branch `claude-license-consistency` (both repos, awaiting the human's merge):** NOTICE, README and AGENTS now describe the same grant as LICENSE (they still said "Small Team, two individuals"); `modifys` typo fixed; the Foundation LICENSE named `ai-research-blog` as its Licensed Work after the online edit (copy-paste) and now names `Adventures.Foundation`.
2. **Human, with the attorney:** confirm (a) the licensor line without "doing business as" (consistent until the DBA is filed, but `CLA.md` and `NOTICE` still use the DBA wording), (b) the one-person cap, (c) AGPL-3.0 versus another GPL-compatible Change License, (d) a plain-language definition of Competing Offering and of "affiliates".
3. **Honour the intent, close the gap:** if two-person start-ups should be welcome, make it two and keep the revenue cap; the revenue and funding ceilings are the real fence. A single "pre-scale operator" definition belongs in one place (LICENSE) and is quoted, not paraphrased, elsewhere.
4. **Private layer from the next stage on, not retroactively:** keep generic mechanics public (stores, auth, the shape interpreter). Put the canonical ontologies, role manifests, multi-tenant control plane and any paid-tier tooling in a private repository that consumes the public packages. This is the beta kit and tenant-scoping work already on the path; add "which side of the line" as a question to each stage.
5. **Keep CLA discipline:** no unsolicited PRs (already policy), CLA before any merge, AI-assistance disclosure. This is what keeps a private fork possible.
6. **Rolling moat:** release the private/paid features ahead of the public baseline; never re-publish a feature under BUSL that is meant to be the paid tier.
7. **Housekeeping already owed:** file the DBA, sign the copyright assignment, unlist early NuGet versions, add a commercial-licence contact page on the website.
