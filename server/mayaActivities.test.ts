import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { applyUserTicTacToeMove, bestTicTacToeMove, createSudoku, ticTacToeResult } from "../client/src/lib/mayaActivityUtils";
import { friendlyChessMove, friendlyConnectFourMove, friendlyLudoToken, friendlyMayaDice, friendlyTicTacToeMove, mayaThinkingDelay, type MayaGameKind } from "../client/src/lib/mayaGamePolicy";
import { createMayaTurnController } from "../client/src/lib/mayaTurnController";
import { WOULD_YOU_RATHER_PROMPTS, applyLudoMove, applySnakesLaddersRoll, connectFourDrop, connectFourResult, create2048Board, createConnectFourBoard, createLudoState, createSnakesLaddersState, is2048GameOver, move2048, nextWouldYouRatherIndex, resolveSnakesLaddersSquare } from "../client/src/lib/mayaExpandedGameUtils";
import { MAYA_GAME_SAVE_ERROR, reportMayaGameSaveFailure } from "../client/src/lib/mayaGameSessionUtils";

describe("Maya activity game logic", () => {
  it("generates boards with more blanks as Sudoku difficulty rises", () => {
    const easy = createSudoku("Easy");
    const hard = createSudoku("Hard");
    const countBlanks = (board: number[][]) => board.flat().filter((cell) => cell === 0).length;

    expect(countBlanks(easy.board)).toBe(38);
    expect(countBlanks(hard.board)).toBe(56);
  });

  it("recognizes tic-tac-toe wins and draws", () => {
    expect(ticTacToeResult(["X", "X", "X", "", "O", "", "", "", "O"])).toBe("X");
    expect(ticTacToeResult(["O", "X", "X", "X", "O", "", "", "", "O"])).toBe("O");
    expect(ticTacToeResult(["X", "", "O", "", "O", "X", "O", "X", ""])).toBe("O");
    expect(ticTacToeResult(["X", "O", "X", "X", "O", "O", "O", "X", "X"])).toBe("draw");
  });

  it("takes a winning tic-tac-toe move when one is open", () => {
    expect(bestTicTacToeMove(["O", "O", "", "X", "X", "", "", "", ""])).toBe(2);
  });

  it("locks the board after a winner or draw is recorded", () => {
    const won = ["X", "X", "X", "", "O", "", "", "", "O"] as Array<"X" | "O" | "">;
    const drawn = ["X", "O", "X", "X", "O", "O", "O", "X", "X"] as Array<"X" | "O" | "">;
    expect(applyUserTicTacToeMove(won, 3)).toBe(won);
    expect(applyUserTicTacToeMove(drawn, 0)).toBe(drawn);
  });

  it("usually lets the user keep an immediate tic-tac-toe winning line open", () => {
    const board = ["X", "X", "", "O", "", "", "", "", "O"] as Array<"X" | "O" | "">;
    const attempts = Array.from({ length: 100 }, (_, index) => friendlyTicTacToeMove(board, () => index / 100));
    const overlookedBlocks = attempts.filter((move) => move !== 2).length;
    expect(overlookedBlocks).toBeGreaterThan(70);
    expect(friendlyTicTacToeMove(board, () => .99)).toBe(2);
  });

  it("returns bounded, game-specific thinking delays", () => {
    expect(mayaThinkingDelay("ticTacToe", () => 0)).toBe(550);
    expect(mayaThinkingDelay("ticTacToe", () => .999)).toBeLessThanOrEqual(1100);
    expect(mayaThinkingDelay("chess", () => 0)).toBe(800);
    expect(mayaThinkingDelay("chess", () => .999)).toBeLessThanOrEqual(1600);
    expect(mayaThinkingDelay("ludo", () => 0)).toBe(700);
    expect(mayaThinkingDelay("snakesLadders", () => .999)).toBeLessThanOrEqual(1250);
  });

  it("locks a game while Maya is thinking and releases the lock only after her move", () => {
    const states: Array<MayaGameKind | null> = [];
    let scheduled: (() => void) | undefined;
    const controller = createMayaTurnController((state) => states.push(state), {
      set: (callback) => { scheduled = callback; return "maya-turn"; },
      clear: () => undefined,
    });
    let completed = 0;

    expect(controller.begin("chess", 800, () => { completed += 1; })).toBe(true);
    expect(controller.isThinking()).toBe(true);
    expect(controller.begin("ticTacToe", 550, () => { completed += 1; })).toBe(false);
    scheduled?.();

    expect(completed).toBe(1);
    expect(controller.isThinking()).toBe(false);
    expect(states).toEqual(["chess", null]);
  });

  it("cleans up a pending Maya turn on reset or unmount without running a stale reply", () => {
    const cleared: unknown[] = [];
    let scheduled: (() => void) | undefined;
    const states: Array<MayaGameKind | null> = [];
    const controller = createMayaTurnController((state) => states.push(state), {
      set: (callback) => { scheduled = callback; return "pending-turn"; },
      clear: (handle) => { cleared.push(handle); },
    });
    let completed = 0;

    controller.begin("ticTacToe", 550, () => { completed += 1; });
    expect(controller.cancel()).toBe(true);
    scheduled?.();

    expect(cleared).toEqual(["pending-turn"]);
    expect(completed).toBe(0);
    expect(controller.isThinking()).toBe(false);
    expect(states).toEqual(["ticTacToe", null]);
  });

  it("chooses a legal gentle chess reply in Maya's playful mode", () => {
    const game = new Chess();
    game.move("e4");
    const reply = friendlyChessMove(game.fen(), () => 0);
    expect(reply).toBeDefined();
    expect(() => game.move({ from: reply!.from, to: reply!.to, promotion: reply!.promotion as "q" | undefined })).not.toThrow();
    expect(reply?.captured).toBeUndefined();
  });

  it("applies Ludo home, capture, bonus-roll, and finish rules without illegal moves", () => {
    const initial = createLudoState();
    expect(applyLudoMove(initial, "user", 0, 5)).toBe(initial);
    const entered = applyLudoMove(initial, "user", 0, 6);
    expect(entered.user[0]).toBe(0);
    expect(entered.turn).toBe("user");

    const captureState = { ...entered, user: [27, -1, -1, -1], maya: [0, -1, -1, -1], turn: "maya" as const };
    const captured = applyLudoMove(captureState, "maya", 0, 1);
    expect(captured.user[0]).toBe(-1);

    const finishState = { ...initial, user: [58, 58, 58, 57], turn: "user" as const };
    expect(applyLudoMove(finishState, "user", 3, 1).winner).toBe("user");
  });

  it("keeps Maya's Ludo token choice legal and avoids a user capture when possible", () => {
    const state = { ...createLudoState(), user: [27, -1, -1, -1], maya: [0, 2, -1, -1], turn: "maya" as const };
    expect(friendlyLudoToken(state, 1, () => 0)).toBe(1);
    const diceRandom = [.999, 0];
    expect(friendlyMayaDice(() => diceRandom.shift() ?? 0)).toBe(5);
  });

  it("keeps a Ludo bonus turn, hands off an ordinary turn, and locks a completed round", () => {
    const opened = applyLudoMove(createLudoState(), "user", 0, 6);
    expect(opened.turn).toBe("user");
    const handedOff = applyLudoMove(opened, "user", 0, 1);
    expect(handedOff.turn).toBe("maya");
    const completed = { ...createLudoState(), user: [58, 58, 58, 58], winner: "user" as const };
    expect(applyLudoMove(completed, "user", 0, 1)).toBe(completed);
  });

  it("resolves Snakes & Ladders jumps, exact finish, and overshoots", () => {
    expect(resolveSnakesLaddersSquare(4)).toBe(14);
    const ladder = applySnakesLaddersRoll({ ...createSnakesLaddersState(), user: 3 }, "user", 1);
    expect(ladder.user).toBe(14);
    expect(applySnakesLaddersRoll({ ...createSnakesLaddersState(), user: 99 }, "user", 1).winner).toBe("user");
    expect(applySnakesLaddersRoll({ ...createSnakesLaddersState(), user: 98 }, "user", 3).user).toBe(98);
  });

  it("retains a Snakes & Ladders bonus roll and locks the board when the round ends", () => {
    const bonus = applySnakesLaddersRoll(createSnakesLaddersState(), "user", 6);
    expect(bonus.turn).toBe("user");
    const complete = applySnakesLaddersRoll({ ...createSnakesLaddersState(), user: 99 }, "user", 1);
    expect(applySnakesLaddersRoll(complete, "user", 1)).toBe(complete);
  });

  it("detects Connect Four wins and makes a frequently gentle legal Maya reply", () => {
    let board = createConnectFourBoard();
    [0, 1, 2, 3].forEach((column) => { board = connectFourDrop(board, column, "U"); });
    expect(connectFourResult(board)).toBe("U");
    expect(friendlyConnectFourMove(createConnectFourBoard(), () => 0)).toBe(0);
  });

  it("prevents a Connect Four move in a full column and clears new-game thinking on cancellation", () => {
    const board = createConnectFourBoard();
    board.forEach((row, index) => { row[0] = index % 2 ? "M" : "U"; });
    expect(connectFourDrop(board, 0, "U")).toBe(board);

    const states: Array<MayaGameKind | null> = [];
    let scheduled: (() => void) | undefined;
    const controller = createMayaTurnController((state) => states.push(state), { set: (callback) => { scheduled = callback; return "ludo-turn"; }, clear: () => undefined });
    let completed = false;
    controller.begin("ludo", 700, () => { completed = true; });
    controller.cancel();
    scheduled?.();
    expect(completed).toBe(false);
    expect(states).toEqual(["ludo", null]);
  });

  it("merges 2048 tiles once per move, creates a start board, and detects a blocked board", () => {
    const start = create2048Board(() => 0);
    expect(start.flat().filter(Boolean)).toHaveLength(2);
    const moved = move2048([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], "left", () => 0);
    expect(moved.score).toBe(8);
    expect(moved.board[0][0]).toBe(4);
    expect(moved.board[0][1]).toBe(4);
    expect(is2048GameOver([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]])).toBe(true);
  });

  it("rotates companion prompts without leaving the curated Would You Rather deck", () => {
    expect(nextWouldYouRatherIndex(WOULD_YOU_RATHER_PROMPTS.length - 1)).toBe(0);
    expect(WOULD_YOU_RATHER_PROMPTS[nextWouldYouRatherIndex(0)]).toContain("memory");
  });

  it("keeps a round playable and gives a clear message if private game-session persistence fails", () => {
    const notices: string[] = [];
    reportMayaGameSaveFailure((message) => notices.push(message));
    expect(notices).toEqual([MAYA_GAME_SAVE_ERROR]);
  });
});
