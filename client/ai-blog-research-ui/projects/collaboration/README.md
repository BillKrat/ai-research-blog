# @adventures/collaboration

The client side of the .NET `Adventures.Collaboration` project: the conversation a developer and an administrator keep under an item or post.

- **`adv-conversation`**: comments, quick replies (Ask, Backlog, Change request), decisions, attachments.
- **`adv-approval-badge`**: the review state (Needs review, Approved, Changes requested); the text is always shown, never colour alone.
- **`AdminDecisions`**: the routed page that lists every recorded decision.
- **`ConversationService`**: the calls behind them.

Depends on `@adventures/core` and `@adventures/entity-ui`. Build order: core, entity-ui, then this. Tests: `ng test collaboration`.
