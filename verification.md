# Maya Verification Notes

## Final regression evidence — 19 August 2026

The latest automated regression run completed successfully: **8 Vitest files and 51 tests passed**, with one opt-in live-credential test skipped by default, followed by a clean `tsc --noEmit` check and production build. The coverage includes extracted activity helpers, player-friendly game policies, explicit input lockout, timer cleanup, voice safety, streamed-chat states, protected companion procedures, Supabase media storage, Groq transcription, absence of the retired image-generation procedure, and safe avatar fallback transitions.

The current desktop (1280×720) and mobile (375×812) previews both render the redesigned WhatsApp-style messenger shell without build or TypeScript errors. The chat layout retains its composer, message area, conversation identity, and responsive header controls at mobile width.

The historical `speechSynthesis.cancel` error points to a prior 1,443-line version of `MayaCompanion.tsx`. The current component is 429 lines and routes every cancellation through `safelyCancelSpeech`, which returns without accessing `cancel` when the speech controller is unavailable. The real call UI delegates listening preparation, stopping, and closing to these tested helpers. After a clean service restart, the Maya landing page loaded successfully and the post-restart browser and server log windows contained **no TypeError, ReferenceError, SyntaxError, or uncaught-error entries**. The sandbox preview had no authenticated session, so the signed-in modal itself was not interactively opened; the focused test verifies the fallback path instead. The stale historical browser-log records were retained only as audit evidence.

### Authenticated call-modal boundary

The verification preview did not have a Manus OAuth session, so it could not open the signed-in call modal interactively. This limitation is documented here rather than inferred away. The shipped call UI invokes the tested recognition resolver before constructing a browser recognizer; when both `SpeechRecognition` variants are unavailable, it reports the existing in-product fallback message and stops before any speech-controller access. Separate tests cover listening preparation, listener stop, and safe modal close with unavailable browser speech playback.

## Verification matrix and remaining authenticated boundary

The desktop checkpoint preview shows the active chat shell with private-chat navigation, empty-conversation suggestions, activity controls, and the composer. The mobile capture confirms that the header and composer remain accessible at 375 px. The responsive drawer component is also rendered under test for both the **Memories** and **Mood Journal** paths. However, the browser session available for this final pass is unauthenticated, so fresh browser screenshots with either signed-in drawer open, and a fresh end-to-end pass across every signed-in interaction, remain pending rather than being inferred from source-level tests.

| Area | Verification method | Result |
|---|---|---|
| Messenger chrome, date/message states, reactions, settings, media, retry flow | Focused unit regressions and prior implementation review | Automated checks passed; fresh signed-in pass pending |
| Memories and Mood Journal drawers | Static component rendering tests | Automated checks passed; fresh signed-in screenshots pending |
| Chess and tic-tac-toe fair play | Deterministic policy tests, timer-controller tests, and responsive game UI review | Passed |
| Voice controls | 30-test suite, guarded browser-API fallback tests, and fresh runtime-log review | Automated checks passed with documented unauthenticated-modal boundary |
| Responsive layouts | Desktop 1280 px and mobile 375 px screenshots | Passed |
| Build health | `pnpm test`, `tsc --noEmit`, post-restart server/browser log window | Passed |
