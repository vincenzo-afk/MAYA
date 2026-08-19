# Maya Game Library Expansion Plan

## Goal

Expand Maya’s existing **Activities** drawer with a small, polished collection of free, fully playable companion games. The new games will remain inside the WhatsApp-style Maya experience, persist game snapshots through the existing per-user game-session flow, and retain the existing fair-play principle: Maya takes legal moves, visibly thinks before responding, and intentionally gives the user favorable opportunities.

The first release will add **Ludo** as the flagship request, plus four complementary game types: **Snakes & Ladders**, **Connect Four**, **2048**, and **Would You Rather / This-or-That**. This provides dice racing, strategy, puzzle, and conversation-first play without duplicating the existing Chess, Sudoku, Tic-tac-toe, brainteaser, math, calendar, voice, and YouTube activities.

## Product Decisions and Assumptions

| Decision | Planned approach |
|---|---|
| Scope | Implement Ludo, Snakes & Ladders, Connect Four, 2048, and Would You Rather in one cohesive activity-library expansion. |
| App integration | Extend the existing React activity drawer rather than add a separate full-screen game engine; these games are turn-based or grid-based and should feel native to chat. |
| Cost | Preserve Maya’s completely free model: no ads, currency, purchase prompts, paywalls, or premium-only games. |
| Play style | User versus Maya for competitive games; Maya applies legal but deliberately gentle choices and delayed turns. Would You Rather is a collaborative chat game. |
| Persistence | Save each meaningful turn, board, score, and outcome with the existing protected `saveGameSession` procedure. No new user-data tables are expected unless the current generic session payload proves insufficient. |
| Visual direction | Use Maya’s existing dark, warm messenger palette, with generated board/texture assets only where they substantially improve the polish. |

## Implementation Phases

### Phase 1 — Design, game contracts, and risk slice

Create a concise game specification for each new activity before implementation. It will define state shape, legal actions, win/finish rules, save payload, Maya’s turn policy, reset behavior, accessibility labels, and verification criteria. The highest-risk slice will be Ludo because it combines dice movement, home/exact-finish rules, captures, multiple tokens, and turn transitions.

Ludo will use a compact two-player format tailored to Maya rather than simulate four players. Each side will have four tokens, standard six-to-leave-home logic, capture rules, bonus rolls for sixes, exact roll-to-finish behavior, and a clear winner state. The user will play the warm accent color and Maya the complementary color. A seeded, injectable random source will drive dice rolls and policy decisions for deterministic tests.

### Phase 2 — Extract reusable board-game foundations

Add framework-independent TypeScript modules under `client/src/lib/` for the new game logic. This keeps rule evaluation testable outside React and follows the existing extracted helper pattern.

| Module | Responsibilities |
|---|---|
| `mayaLudoUtils.ts` | Board positions, legal token moves, safe-zone/capture handling, turn and extra-roll logic, finished-state detection, and serializable state. |
| `mayaLudoPolicy.ts` | Maya’s legal-token selection, intentionally imperfect priorities, user-favoring capture choices, and injectable randomness. |
| `mayaBoardGameUtils.ts` | Connect Four drop/win detection, Snakes & Ladders move resolution, 2048 merge/spawn/game-over logic, and shared seeded-random helpers where appropriate. |
| `mayaSocialGameUtils.ts` | Curated, safe prompt deck, round state, and answer formatting for Would You Rather. |

Extend the existing `createMayaTurnController` only if the new games need a reusable delayed-turn queue. Otherwise, use the already-tested controller unchanged so one active Maya turn blocks duplicate input and cancellation safely clears pending timers on reset, navigation, and unmount.

### Phase 3 — Build each activity in the existing drawer

Extend `MayaActivities.tsx` and its menu with five new entries. Each activity will provide an instruction line, keyboard-accessible controls, a reset button, visible score/progress where relevant, a Maya status line, and a “Talk about this with Maya” handoff to the companion chat after wins, losses, or funny moments.

**Ludo** will use an accessible two-player board with color-independent labels, a dice-roll button, clearly highlighted legal tokens, animated-but-short Maya thinking states, and concise narrative reactions. Maya will favor non-capturing choices and miss many advantageous captures so users win noticeably more often without impossible moves.

**Snakes & Ladders** will be a fast shared race. The user and Maya take turns rolling; Maya will use a small amount of gentle dice bias only where it does not create visibly implausible rolls. Ladders, snakes, and exact-finish rules will be explicit in the UI.

**Connect Four** will provide a seven-column board, a drop preview, win/draw lockout, and a friendly Maya policy that often overlooks blocks or takes non-optimal columns. The existing thinking overlay and controller pattern will prevent moves during Maya’s turn.

**2048** will be a solo board played with Maya cheering, offering optional hints and low-pressure milestones. Maya will not make moves on the user’s board; instead, her activity response will identify a gentle opportunity after a move. Keyboard arrows and touch buttons will both be supported.

**Would You Rather** will offer a rotating deck of playful, non-explicit, emotionally warm choices. Both answers will appear in the round state, and a button will pass a tailored discussion prompt into Maya’s chat.

### Phase 4 — Assets and visual polish

Create a single visual-direction reference for the expanded game library and record it in the game asset manifest. Generate only the assets that add real value, such as a subtle Ludo board texture, dice face treatment, and small illustrated game badges; then upload them through project-managed storage. Small grid boards can remain CSS/SVG-based for performance, sharpness, theme compatibility, and accessibility.

Add CSS to `maya-activities.css` for the new boards, responsive layouts, legal-move highlighting, dice feedback, score chips, celebration states, and reduced-motion fallbacks. Preserve the existing dimmed-board and pulsing “I’m thinking…” language during Maya turns.

### Phase 5 — Persistence, chat context, and safety

Save serializable state after every dice roll, token move, board move, score change, and completed round. Each saved session will include `gameType`, the current serialized state, and a meaningful result such as `user-won`, `maya-won`, `draw`, `in-progress`, or `completed`.

Use the established protected Maya procedures so game data remains scoped to the signed-in Manus OAuth user. Keep the social prompt deck age-appropriate and avoid coercive, sexual, gambling-like, or financial game mechanics. Ludo and dice games will remain recreational; they will not include stakes, wagers, credits, or rewards of value.

### Phase 6 — Tests and verification

Add deterministic Vitest coverage alongside the existing activity tests. Tests will cover legal moves, invalid-input lockout, capture and finish rules, dice-turn transitions, game-over lockout, state serialization, player-friendly policy bounds, delayed Maya turns, and timer cancellation for every turn-based competitive game. Existing tests will be updated only when the public utility contract changes.

| Verification area | Required evidence |
|---|---|
| Ludo | Legal leave-home moves, captures, safe/finish logic, extra turns, exact finish, winner lockout, and a user-favoring Maya policy. |
| Snakes & Ladders | Snake/ladder resolution, overshoot handling, winner lockout, and turn changes. |
| Connect Four | Column filling, all four win directions, draw, thinking lockout, and intentional missed blocks. |
| 2048 | Merge-once-per-move behavior, score changes, spawning, keyboard/touch action, game-over, and reset. |
| Would You Rather | Prompt rotation, answer persistence, and chat handoff. |
| Integration | Desktop and 375 px mobile screenshots for each new game, activity navigation, saved-session calls, no console/runtime errors, `pnpm test`, and `pnpm exec tsc --noEmit`. |

### Phase 7 — Release and handoff

Update the README and verification record with the expanded games and fair-play behavior. Capture a project checkpoint after the suite and responsive checks pass, then commit and push all source, tests, documentation, and assets to `github.com/vincenzo-afk/MAYA` using the requested `vincenzo-afk <itsmebk2007@gmail.com>` author identity.

## Risks and Mitigations

The principal risk is Ludo’s rules becoming unclear on a small screen. This will be mitigated with a simplified two-player board, short rule copy, high-contrast legal-token highlights, and deterministic test cases for every special rule. The secondary risk is making Maya’s losses feel artificial; the policy will therefore make legal, plausible moves with a deliberately imperfect priority function rather than forcing outcomes. Generated imagery will be limited and stored outside the repository source tree to avoid build-size and deployment problems.

## Definition of Done

The expansion is complete when all five activities are playable in Maya’s activity drawer, remain free, work on desktop and mobile, save private progress, respect the companion’s user-favoring play style, provide accessible control labels and turn feedback, pass the expanded automated suite and TypeScript check, are visually verified in the running app, and are checkpointed and pushed to the requested GitHub repository.
