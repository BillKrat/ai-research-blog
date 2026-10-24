# Review post template (review loop step 2)

Create a Developer collaboration item (Admin > Collaboration; `Claude-author.ps1 -Action collab-new`, not a post) with these sections, in this order. Keep it short enough to read in a review visit; link the stage review in `docs/artifacts/` for detail. Replace everything in angle brackets.

```markdown
## Summary
<Two or three sentences: what changed and why, in the reader's words, not file names.>

## Status
- Branch: `<branch>` in <repos>, committed, not merged.
- Verified: <tests run with counts; what was exercised end to end>.
- Not verified: <what could not be checked and why>.

## Run it locally
<Exact commands, one per line, in a code block; the sign-in to use; the address to open.>

## Test steps
1. <Where to go and what to do.> Expect: <what you should see.>
2. <Next step.> Expect: <...>
3. <An edge case or refusal to try.> Expect: <...>

## After approval (deployed check)
- [ ] <What to look at on the live site, two or three items.>
- `Claude-verify.ps1` result: <pasted after deploy>.

## Decisions needed
1. <Question, my recommendation, and what changes if you choose otherwise.>
```

Rules:
- The human's answers go in the post's Conversation (the human uses the quick replies, or Claude copies what was said in chat and says so).
- Claude never marks the post Approved and never records a Decision; only the human does.
- Merge and deploy wait for "approved" in chat and an Approved state on the post.
