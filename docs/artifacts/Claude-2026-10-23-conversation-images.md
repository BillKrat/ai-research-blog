# Stage review: images and preview in the conversation reply box (2026-10-23)

Branch `claude-conversation-markdown` (client only, stacked on `claude-session-expiry`). Asked by the human while testing: replying with a screenshot meant uploading it to the post first and copying the address.

**Change:** the reply box under a post has two icons: add a picture (uploads it and inserts the Markdown at the cursor, using the same safe upload as the post editor, so the same refusals apply) and preview (shows the reply rendered, then back to editing). Conversation entries already rendered Markdown; what made the earlier replies hard to read was that they were written as one paragraph, so replies from Claude now use headings, short lists and code blocks.

**Verified:** 3 new tests (upload inserts at the cursor, a refusal shows the server's words and changes nothing, preview renders then returns to the editor), client 86 passing, production build.
**Not verified:** the buttons in a browser.

## Follow-up: the two icons moved to the top row

The human looked for Insert and Preview at the top left, beside Approve and Ask, and did not notice them under the box. They now sit at the right end of that top row (right-aligned). Verified: client 89 passing.
