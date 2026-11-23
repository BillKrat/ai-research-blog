# Decision: quad storage layout (beta row 9)

Date: 2026-11-23. APPROVED by the human the same day ("Yes, build it"); implementation step 1 (the store, the factory, the hosts) is DONE, see `artifacts/Claude-2026-11-23-dictionary-quad-store.md`; tools, cutover and the pristine store are next. Owner of the decision: Claude. Plan and background: `Claude-backlog-quad-storage.md`. Tool: `docs/Claude-quad-bench` (workspace root). Raw results: below; run on the local dev PostgreSQL 17 (the VM), warm cache, synthetic blogs shaped from the measured live store (section 4c of the plan).

## Decision

**Adopt the hybrid layout "H" behind the existing store interface:** the terms that are IRIs (subject, predicate, graph, and an object that is an IRI) become rows of a dictionary and the quad row holds integers; every literal (title, slug, date, body) stays inline as text in the quad row. The standard is kept at the edges: import, export, the MCP tools and the seeds stay full N-Quads with full IRIs, expanded from the dictionary on the way out. The GUID stays the identity everywhere outside the store (tokens, links, seeds, post bodies, tools); the integer is an internal handle the store resolves, as the human's proposal was adjusted in the plan, section 4b.

Shape of H (as benchmarked):

- `terms_h(id bigint identity, value text unique)`, IRIs only.
- `quads_h(id bigint pk, g, s, p bigint, o bigint null, lit text null)`: `o` for an IRI object, `lit` for a literal, exactly one of them set.
- Indexes: `(s, p, g)`, `(p, o, g, s) WHERE o IS NOT NULL`, `(p, left(lit, 255), g) WHERE lit IS NOT NULL`, `(g, p, s)`, plus the two primary keys and the unique index on `terms_h.value`.
- Reads go through a bounded in-process term cache (predicates, types and graphs stay hot; subjects are cached on demand with a size limit), so a query returns integers and the store expands them in memory.

## Why H and not the full dictionary (C) or today's text table (T)

Results at 1,000 blogs (4,009,000 quads; 125,000 long literals; 1,884,762 distinct short terms of which 493,100 are IRIs):

| | T today | C full dictionary | H hybrid |
|---|---|---|---|
| Bytes per quad (all in) | 841 | 563 | **511** |
| Smaller than T | n/a | 1.49 times | **1.64 times** |
| Without the 870 MB of body text that every layout shares | 2.50 GB | 1.39 GB | **1.18 GB** (2.1 times smaller than T) |
| Index build | 50 s | 18 s | 21 s |

Query shapes at 1,000 blogs, p50 / p95 in milliseconds, SQL expands the ids back to text (the worst case for C and H):

| Shape | T | C | H |
|---|---|---|---|
| By subject (load one post) | 0.84 / 1.20 | 1.72 / 2.32 | 1.04 / 1.33 |
| By subject and predicate | 0.45 / 0.51 | 0.90 / 1.26 | 0.76 / 1.00 |
| By predicate+object in a graph (post by slug) | 0.34 / 0.57 | 0.71 / 1.06 | 0.69 / 0.90 |
| By predicate+object in a graph (list posts, 100 rows) | 9.84 / 12.29 | 3.16 / 4.20 | **1.22 / 1.67** |
| By predicate+object, no graph (count every post) | 354.87 / 367.37 | 8.18 / 9.18 | 8.24 / 9.34 |
| By graph (export one tenant's graph, 3,510 rows) | 8.98 / 10.65 | 49.54 / 54.08 | 47.54 / 52.53 |
| Write one new post (15 quads), no client cache | 2.89 / 3.91 | 2.78 / 4.25 | **1.66 / 2.35** |

The same shapes when the app resolves terms from its cache and the query returns the integers (the design above):

| Shape | C | H | T (as above) |
|---|---|---|---|
| By subject, ids only | 0.43 / 0.65 | **0.35 / 0.48** | 0.84 / 1.20 |
| List posts in a graph, ids only | 0.37 / 0.84 | **0.35 / 0.58** | 9.84 / 12.29 |
| Export a tenant graph, ids only | 4.38 / 7.54 | **4.14 / 6.31** | 8.98 / 10.65 |

Once terms come from the cache, H equals or beats T on every shape and is the smallest of the three.

What the numbers say:

1. **The size gain is real but modest on its own.** About 1.64 times smaller overall; 2.1 times on everything except body text. My earlier estimate of three times assumed far more repetition in the data than a blog has: titles, slugs, dates and bodies are mostly unique, and a dictionary only wins on repeated terms. Predicates, types and graphs are what repeat, and those go into the dictionary in both C and H.
2. **The big win is the shape of the indexes, not the width.** Listing a tenant's posts is 8 times faster than today and counting a kind 40 times faster, because the new indexes lead with what the query filters on (and carry the graph). Today's `(predicate, left(object, 255))` index reads every tenant's rows and filters the graph afterwards, so it gets slower with every tenant added (3.0 ms at 300 blogs, 9.8 ms at 1,000).
3. **H beats C** on size (about 10% smaller, 3.5 times smaller dictionary, fewer unique dictionary rows to look up on write) and on the write path (1.66 ms against 2.78 ms), and it keeps the literal lookups (slug, user name) in one inline index. C puts every unique literal in the dictionary: 1.88 million rows, 410 MB, to save nothing.
4. **The cost is the read path through terms.** With SQL joins a whole-tenant export is 5 times slower than today (48 ms against 9 ms); with the term cache it is faster than today. So the cache is part of the design, not an optimisation. Cache misses cost one extra lookup.
5. **Writes** resolve terms first (an upsert on the dictionary, then the insert). With no cache it is no worse than today's; with the cache it is cheaper.

## What this does NOT settle (be honest)

- **The 1000 MB quota is still the binding limit for blogs of this size.** At 511 bytes a quad a 4,000-quad blog with 100 posts is about 2.1 MB with its bodies (3.4 MB today), so the base plan holds roughly **470 such blogs with H against 290 today**, not 1,000. Real prose compresses better than my random words (TOAST already compresses the bodies), so the real figure should be better; it must be measured on real posts. A smaller blog fits proportionally more.
- **Synthetic data:** the literals are my guess at a blog's variety (mostly unique). If real data repeats literals more than that, a hybrid that also dictionary-encodes repeated short literals could win more; not worth building before a measurement of real beta data.
- **Local machine, warm cache, one client:** the ratio between layouts is what counts; the shared host is slower and has less memory. A run on the second hosted database of the plan (the plan's step in section 8.2) is still to do before beta; it needs the human to create that database.
- **Term cache memory:** 493,100 IRI terms at 1,000 blogs is about 40 to 60 MB if everything were cached, which is too much for a shared pool; the cache must be bounded (a few thousand hot terms plus an LRU of subjects).

## Consequences and plan (each its own small verified stage with a stage review)

1. **Implement behind `INQuadStore`**, tests first: the existing store contract tests run against both layouts; the in-memory store stays; N-Quads import and export round trip; tenant isolation unchanged. New class beside `NpgsqlNQuadStore` (`Adventures.Data.NQuad.Postgres`), chosen by the existing `NQuadStore:Provider` setting.
2. **Tools:** `Claude-nquad-tool` (export, restore, relabel, grant, reset-password), the NQuad browser (S8), the seed loader and the schema site must read the new layout; relabel becomes an update of one dictionary row per graph instead of a rewrite of rows.
3. **No data migration of the live store as such:** row 11 builds a pristine beta store from the numbered seeds only (this removes the 102,640 dead audit quads, 85% of today's rows), so the new layout is born clean. The dev store gets the same treatment locally. The verified export from `Claude-nquad-tool` of the current store stays as the safety net (and the old table is kept for a release).
4. **Re-measure** against the target after the layout is live (and run the benchmark on the second hosted database).
5. Update `Claude-architecture-reference.md` when the implementation lands.

## Decisions for the human (recommended answers first; unanswered counts as agreed)

1. Hybrid H as above. (Recommended.) The alternative is to keep today's table and add only the index fixes (below); that buys the list and count speed-ups but not the size.
2. Build the pristine store from seeds instead of migrating live data, and delete the dead audit quads there. (Recommended; the live store is not touched until the cutover, which is rehearsed and needs his word.)
3. Cheap fixes that need no new layout and could ship at once: an index `(graph, predicate, left(object, 255))` for tenant-scoped listings, dropping `ix_subject` and `ix_predicate` (covered by the composites, about 4 MB). Take them now or fold them into the new layout? (Recommended: fold in; they do not matter to beta on their own.)

## Raw results

Runs of 2026-11-23 on the local PostgreSQL 17 (VM), 300 blogs (1,202,700 quads) and 1,000 blogs (4,009,000 quads), 200 queries per shape after 20 warm-ups, `VACUUM (ANALYZE)` before measuring. At 300 blogs: T 845, C 570, H 512 bytes per quad (1.48 and 1.65 times smaller); list posts T 3.04, C 1.24, H 1.18 ms; count every post T 108.40, C 2.65, H 2.62 ms; whole-tenant export with SQL expansion T 6.19, C 47.57, H 42.22 ms (ids only 3.86, 4.01); write one post T 0.99, C 1.43, H 1.23 ms. The tool prints everything shown here: `dotnet run --project docs\Claude-quad-bench\Claude-quad-bench.csproj -- run -Tenants 1000` (the local scratch schema `quadbench` only; it refuses any non-local host).
