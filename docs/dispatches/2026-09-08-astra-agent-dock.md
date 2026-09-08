# Agent dock: readable conversations and retained sessions

Founder report: on live New bee, the dock displayed an entire page inside its small frame. A second view chooser and a dark, horizontally scrolling directory displaced the conversation. The screenshot also showed that navigation inside the frame could replace the agent with the museum.

## What changed

`surfaces/agent-dock.js` now mounts each conversation lazily and keeps its iframe attached for the lifetime of the host page. Switching agents, opening Help, closing the dock and changing views retain separate conversations and unsent drafts. A compact embedded presentation hides the child page's site chrome, starts at the greeting, and puts suggestions, sources and voice controls in a native disclosure. The parent supplies one textarea and Send control. Expand/Restore provides a larger reading area.

New bee uses a cream canvas, clear capability labels and readable replies; Raver uses purple/teal/green accents; Cypherpunk retains a denser monospace presentation. Phone sizing reserves the actual scrollbar width. Short screens and visual keyboard viewports are bounded. The initial phone inspection caught right-edge clipping; the expanded New bee inspection caught a legacy purple receipt background. Both were corrected without hiding document overflow.

The old outer Send posted a message that heARTh did not handle. The shared composer now checks the live same-origin frame location and its existing `q`/`ask` interface before delivering to either engine. A failed or not-ready send retains the draft and names the failure. Enter sends; Shift+Enter and IME composition do not. Help/install commands require an exact slash command, so ordinary words such as “happy” and “application” remain prompts.

bAigents is explicitly a build-status card with no chat endpoint. bLOVErAi builds a selectable handoff from only its own questions; it does not include conversations from the other agents or send to an AI service. Clipboard rejection, synchronous exceptions and out-of-order completions keep the prepared text and report the relevant result.

The dock's source links and explicit Open page action carry visible new-tab labels and `noopener noreferrer`, preserving the active conversation instead of replacing the agent frame. Same-page anchors remain local. This is scoped to the dock's reading context; ordinary host-page navigation and shared `tour.js` are unchanged.

`surfaces/bqueenbee-live.html` and `surfaces/blight/hearth.html` expose suspension hooks for retained but inactive frames. Closing, changing agent or opening Help stops microphone capture and speech/audio already owned by that engine. Delayed hidden responses still render text but cannot start audio. Voice preferences remain. The Queen's legacy message bridge now validates parent, origin, payload type and size rather than silently truncating a prompt to 300 characters. Browser speech copy no longer claims that a browser API proves local processing.

The existing hub generator and generated page request dock version 8 together. The dock also versions its two embedded page URLs so a returning visitor does not combine the new retained sessions with a cached child page that lacks its suspension hook. No new surface, dependency, remote agent endpoint, storage migration or production-box change is introduced.

## Evidence

- Local review and test worker: one Codex subagent, inherited model/effort, filesystem session; read-only source review followed by sole ownership of `e2e/agent-dock.test.mjs`. Astra retained implementation and browser review. No additional paid cloud fleet was started.
- `node --test e2e/atlas.test.mjs e2e/agent-dock.test.mjs e2e/register.test.mjs e2e/lang-coverage.test.mjs`: **62 passed**, including **27 dock tests**. The latter execute nested DOM/iframe lifecycles, failure boundaries, source-link attributes, clipboard races, drafts, keyboard handling and view propagation. Additional cases execute the actual Queen speech/bridge hooks and heARTh inline audio lifecycle using controlled API doubles.
- Actual local browser: Queen answered “What is kandi?” from the outer composer. heARTh accepted “How can I make a happy creative application?” and returned its fallback, rather than install instructions. Agent switches retained separate unsent drafts and the existing messages. Help retained the conversation. A generated kandi receipt opened another tab while the original agent stayed present. Building a handoff produced only its own question and the public context.
- Rendered checks: New bee, Raver and Cypherpunk; 390px phone width, 1440px desktop width, expanded mode and a short 800 x 400 viewport. After the phone correction, the dock bounds were approximately 8..367px within the 375px document. Its embedded document had no horizontal overflow and started with the greeting at 12px, scroll position zero. New bee receipt text was `rgb(41, 98, 143)` over a transparent background on the light message card.
- `node --check surfaces/agent-dock.js` and `git diff --check`: passed.
- The first pre-commit `node e2e/estate-source.mjs` run reported **10 pass / 1 fail**: “the committed hub matches its registry regeneration (byte for byte)”. This check compares HEAD rather than the working copy and restored the old hub. The generator was rerun; the commit carries the version-8 output. The post-commit gate passed **11/11** at `9b5376ba`. Candidate CI and release evidence belong in the PR record.

These are software and rendered-browser checks, not a human usability study. Microphone permissions and audible playback on physical devices were not exercised; their suspension logic was tested with controlled browser API doubles. New dock copy is English; a complete translated dock and native-language review are not claimed. The existing authored/keyword engines and their source claims remain separate from this shell upgrade. Conversations survive view/agent changes within this page, but leaving or reloading clears them, as stated in Help.

## Release and rollback

Based on main `04b2def9`, isolated worktree `wt-astra-agent-dock`. Candidate CI, the integration commit and served-byte checks will be recorded on the PR before calling this live. Rollback is a normal revert of this dock change, including the paired engine hooks and generated hub version. No box restart or data conversion is required.
