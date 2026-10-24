# Decision: licensing (2026-10-24)

**Status:** adopted by the human on 2026-10-24; text awaits attorney review before Production.

## Decision

`ai-research-blog` and `Adventures.Foundation` move from MIT to the **Business Source License 1.1 (BUSL-1.1)** with our own parameters. Licensor: **Diane Kratochvil, doing business as Adventures On The Edge** (assumed-name certificate to be filed at the county clerk).

| Parameter | Value |
|---|---|
| Free production use | A **Small Team**: an individual or organization (with affiliates) in which no more than **two** individuals develop, modify, deploy or administer the work or software built on it |
| Never free | A **Competing Offering**: a hosted, managed or embedded platform whose value derives primarily from the work. Building apps for yourself or clients on top is allowed unless the app is itself such a platform |
| Non-production use | Always allowed (BUSL standard) |
| Larger organizations | Commercial license or subscription from the Licensor |
| Change Date | 4 years after each version's first publication (2030-10-24 for this one) |
| Change License | AGPL-3.0-only |

## Why

- The goal is to keep the service free for individual developers and 1-2 person shops, and to earn from larger organizations, without creating our own competitors as the user base grows (the platform may outgrow SmarterASP, which means real cost).
- AGPL alone is open source: anyone, including a funded competitor, may host it if they publish changes. It does not protect the market. BUSL does.
- BUSL as a Small Team grant fits the "thin client on Foundation" offer: a small shop can stand up a client with minimal effort for free.
- AGPL-3.0 as the Change License is the most restrictive open-source terms the BUSL covenants allow, and each version converts on its own clock, so the newest code stays protected.
- Subscriptions for larger organizations are compatible: BUSL requires a commercial license outside the grant, and that license can be a subscription.

## Contributions

- Default: no unsolicited code (`CONTRIBUTING.md`). Issues and security reports are welcome.
- Any accepted code needs the CLA (`CLA.md`): a license, not an assignment, with the right to relicense (needed for commercial licenses and the Change License). Significant contributions need a separate written credit and compensation agreement before merge.
- A DCO alone was rejected: it gives no relicensing right.

## Dependency audit (2026-10-24)

- **NuGet** (all `PackageReference`s in both repos): Microsoft.* (MIT), Dapper, Serilog, OpenTelemetry, xunit (Apache-2.0), MessagePack, coverlet (MIT), Npgsql (PostgreSQL license). No copyleft.
- **npm** (275 packages in the Angular client): MIT 286, ISC 49, Apache-2.0 13, BSD 15, others permissive. MPL-2.0 (file-level copyleft, build tool `lightningcss`, unmodified) and `dompurify` (MPL-2.0 OR Apache-2.0). `khroma` declares no license field in `package.json` (upstream is MIT; verify before Production). No GPL/AGPL/LGPL.
- Result: nothing blocks BUSL, and nothing blocks the AGPL Change License.

## Limits and open items

1. **Earlier versions stay MIT.** The repositories were public under MIT before this change, and early NuGet packages were published; copies already obtained keep MIT for those versions. The git history was reset to a single commit on 2026-10-24; the full prior history is archived privately. No release tag was created.
2. **Licensor identity.** The licensor is the human's spouse as a sole proprietor. Open: file the assumed-name certificate for "Adventures On The Edge" at the county clerk, and sign a written copyright assignment from the human to the licensor (Claude drafts it; an attorney reviews it).
3. **Registrations.** After the assumed name exists: US Copyright Office registration of the code and a USPTO trademark application for "Adventures On The Edge".
4. **AI-authored code.** Copyright in AI-generated material is uncertain; the human directs and reviews all of it. Raise with the attorney.
5. **Contact address.** `LICENSE` names https://AdventuresOnTheEdge.net; replace with a licensing mailbox when one exists.
6. **Commercial license terms and price list** are not written. Needed before the first sale.
7. **NuGet.** Unlist the early Adventures.* package versions on nuget.org (the human does this). Future packages carry `BUSL-1.1`.
8. **Attorney review** of `LICENSE` (parameters only; the BUSL text itself must not change), `CLA.md` and the Additional Use Grant wording.
