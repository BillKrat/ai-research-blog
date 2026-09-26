# Bug Report: "Edit outside workspace" trust dialog hangs AI-agent tool calls and cannot be dismissed

## Summary

When a GitHub Copilot / AI coding agent running inside Visual Studio invokes a file-editing tool (create/edit) against a file path that lies **outside the currently open workspace/solution root** — but still on the local disk (e.g. a sibling git repository referenced via a relative `../` path in a `.slnx`/`.sln`) — Visual Studio raises a modal "trust"/"edit outside workspace" confirmation dialog. This dialog:

1. Blocks the calling tool's synchronous completion (the agent's tool call never returns a result).
2. Cannot be dismissed by clicking any visible button in the dialog (repeated clicks on Allow/Cancel/OK do not close it).
3. The **only** reliable way to unblock the session is to cancel/interrupt the *agent's in-flight tool call* itself (i.e. stop the background operation from the agent/chat side), not to interact with the dialog UI.

This is highly disruptive for agent-driven workflows, because the agent has no supported way to detect that the dialog appeared, no way to dismiss it programmatically, and the user has no way to close it from the dialog itself.

## Environment

- **Visual Studio version:** Visual Studio Community 2026 (18.11.0-insiders)
- **Feature area:** GitHub Copilot / AI agent tool-calling file edit tools (equivalent of "create file" / "replace string in file" operations) invoked from Copilot Chat's agent mode
- **OS:** Windows (running under Parallels on macOS, if relevant to repro)
- **Workspace layout:** Multi-repo workspace where the open solution/workspace root is one git repository, and the solution references projects in **sibling repositories** via relative paths outside the workspace root, e.g.:

  ```text
  M:\Dev\repos\ai-research-blog\        <- open workspace root (contains AiBlogResearch.slnx)
  M:\Dev\repos\Adventures.Foundation\   <- sibling repo, referenced via ../Adventures.Foundation/... in the .slnx
  M:\Dev\repos\poc\                     <- another sibling repo, referenced similarly
  ```

- **Solution file:** `M:\Dev\repos\ai-research-blog\AiBlogResearch.slnx`, which includes project references such as:

  ```xml
  <Project Path="../Adventures.Foundation/src/Adventures.Entities/Adventures.Entities.csproj" />
  ```

## Repro Steps

1. Open `AiBlogResearch.slnx` (workspace root `M:\Dev\repos\ai-research-blog\`) in Visual Studio 2026 Insiders.
2. Ensure the solution references at least one project physically located outside the workspace root via a relative path (e.g. `../Adventures.Foundation/...`), as shown above.
3. Start a Copilot Chat agent-mode session.
4. Ask the agent to create or edit a source file that lives under the sibling-repo path (e.g. `M:\Dev\repos\Adventures.Foundation\src\Adventures.Entities\SomeFile.cs`), using the agent's built-in "create file" or "edit file" tool (not a terminal command).
5. Observe that Visual Studio raises a modal dialog to the effect of "This file is outside your open workspace. Do you want to allow this edit?" (exact wording may vary).
6. Attempt to click any button in the dialog (Allow, Cancel, OK, the title-bar close X).

## Expected Behavior

One of the following should occur:
- The dialog should be dismissible by the user via any of its standard buttons/close affordances, returning control to the calling tool (either proceeding with or cancelling the edit), **or**
- The agent tooling should detect that the target path is outside the workspace **before** invoking the underlying edit API and either (a) prompt the user through the chat UI instead of a modal dialog, or (b) fail fast with an actionable error the agent can react to, **or**
- The dialog should not appear at all for paths that are part of an already-loaded, trusted, referenced project within the currently open solution (since the sibling project is explicitly referenced by the open `.slnx` and already loaded/trusted for build/IntelliSense purposes).

## Actual Behavior

- The modal dialog appears but does not respond to mouse clicks on any of its buttons or its close box; it appears to be waiting for a signal that never arrives through normal UI interaction.
- The underlying tool call from the agent never completes or times out — the chat/agent session appears "stuck" (the tool invocation is pending indefinitely).
- The **only** way found to recover is to interrupt/cancel the *agent's tool call* (i.e., stop the request from the Copilot Chat/agent side, such as clicking "Stop" on the in-progress agent turn). Once the in-flight tool call is cancelled, the modal dialog closes/disappears on its own, and the IDE becomes responsive again.
- No file corruption or partial writes were observed after recovery in this instance, but this cannot be relied upon in general, since the state of the edit at the time of cancellation is unclear (todo/verify: confirm from Microsoft whether partial writes are possible).

## Impact

- Breaks agent-driven development workflows for any multi-repo workspace where a solution legitimately references sibling repositories outside the workspace root (a common and supported project-linking pattern via relative paths in `.sln`/`.slnx`).
- Forces users/agents to work around the bug entirely by avoiding the affected editor tools for any out-of-workspace path and instead using terminal-based file operations (e.g., PowerShell `Set-Content`, `Get-Content -replace`) for all edits to sibling-repo files — which is a functional workaround but defeats the purpose of having a rich file-editing tool in the first place, and increases risk of encoding/formatting mistakes (e.g., manual tab/newline escaping errors) that the built-in tool would normally handle correctly.
- Because the dialog cannot be dismissed by any UI interaction, a user unfamiliar with the "cancel the agent tool call instead" workaround has no discoverable way to recover the session other than force-closing Visual Studio, losing in-progress agent context/work.

## Workaround Currently in Use

1. Do not use the agent's built-in file create/edit tools for any path outside the open workspace root, even when that path is a project explicitly referenced by (and already loaded as part of) the open solution.
2. Instead, perform all such edits via terminal commands (PowerShell `Set-Content`, `Get-Content -Raw` + `-replace`, `New-Item`, `Copy-Item`, etc.), building file content as single-line strings (using `` `n `` for newlines) to avoid additional PowerShell here-string issues encountered separately.
3. If the dialog is inadvertently triggered anyway, cancel/interrupt the in-flight agent tool call (do **not** attempt to click the dialog's buttons) to recover the session; verify afterward that no partial/locked file was left behind before resuming.

## Suggested Fix / Ask

- Make the "edit outside workspace" trust dialog properly modal and responsive to its own buttons, so users can dismiss it directly.
- Alternatively/additionally, treat files belonging to projects that are already referenced by the currently open solution (even via relative paths pointing outside the workspace root) as implicitly trusted, since they are already loaded, built, and browsed as part of the open solution — the same trust boundary that already applies for build/IntelliSense should extend to file edits.
- Ensure any such trust prompt is either (a) surfaced through a non-blocking channel the agent can query/respond to programmatically, or (b) time-bounded so a stuck dialog cannot indefinitely hang an agent tool call/session.

## Additional Notes

- This was encountered multiple times in the same session across different tools (`create_file`-equivalent and `replace_string_in_file`/edit-equivalent), confirming the issue is not specific to a single tool but to any editor-level file write targeting a path outside the workspace root.
- The workspace in question is a legitimate, supported multi-repo layout: a primary app repository (`ai-research-blog`) whose solution file intentionally links to shared library projects living in sibling repositories (`Adventures.Foundation`) and a proof-of-concept repository (`poc`), all cloned as siblings under `M:\Dev\repos\`.
