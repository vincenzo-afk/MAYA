import { Chess, type Square } from "chess.js";
import { bestTicTacToeMove, ticTacToeResult, type TicTacToeCell } from "./mayaActivityUtils";
import { applyLudoMove, connectFourAvailableColumns, connectFourDrop, immediateConnectFourMove, ludoLegalTokens, type ConnectFourBoard, type LudoState } from "./mayaExpandedGameUtils";

export type RandomSource = () => number;
export type MayaGameKind = "chess" | "ticTacToe" | "ludo" | "snakesLadders" | "connectFour";

export type FriendlyChessMove = {
  from: Square;
  to: Square;
  promotion?: string;
  san: string;
  captured?: string;
};

const clampUnit = (value: number) => Math.max(0, Math.min(.999, value));

/**
 * Gives Maya a brief, human-feeling pause without making a casual round feel slow.
 * The random source is injectable so the policy remains deterministic in tests.
 */
export function mayaThinkingDelay(kind: MayaGameKind, random: RandomSource = Math.random) {
  const [minimum, maximum] = kind === "chess" ? [800, 1600] : kind === "ludo" || kind === "snakesLadders" ? [700, 1250] : [550, 1100];
  return Math.round(minimum + (maximum - minimum) * clampUnit(random()));
}

/**
 * Choose a legal reply that normally avoids captures, checks, and queen pressure.
 * Maya remains occasionally competent, but she deliberately keeps the game welcoming.
 */
export function friendlyChessMove(fen: string, random: RandomSource = Math.random): FriendlyChessMove | undefined {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  if (!moves.length) return undefined;

  const gentleMoves = moves.filter((move) => !move.captured && !move.san.includes("+") && move.piece !== "q");
  const isPlayfulRound = random() < .82;
  const candidates = isPlayfulRound && gentleMoves.length ? gentleMoves : moves;
  const choice = candidates[Math.floor(clampUnit(random()) * candidates.length)] ?? candidates[0];

  return choice ? {
    from: choice.from,
    to: choice.to,
    promotion: choice.promotion,
    san: choice.san,
    captured: choice.captured,
  } : undefined;
}

/**
 * Maya usually overlooks the strongest tactic, particularly a necessary block.
 * She still makes a strong move in a small minority of rounds to feel believable.
 */
export function friendlyTicTacToeMove(cells: TicTacToeCell[], random: RandomSource = Math.random) {
  const available = cells.map((cell, index) => cell ? -1 : index).filter((index) => index >= 0);
  if (!available.length || ticTacToeResult(cells)) return undefined;

  const strongest = bestTicTacToeMove(cells);
  const softerChoices = available.filter((index) => index !== strongest).filter((index) => {
    const next = [...cells];
    next[index] = "O";
    return ticTacToeResult(next) !== "O";
  });

  if (random() >= .78 || !softerChoices.length) return strongest ?? available[0];
  return softerChoices[Math.floor(clampUnit(random()) * softerChoices.length)] ?? softerChoices[0];
}

/** Maya rolls a little less aggressively in chance games, leaving more comeback room. */
export function friendlyMayaDice(random: RandomSource = Math.random) {
  const roll = 1 + Math.floor(clampUnit(random()) * 6);
  return roll === 6 && random() < .74 ? 5 : roll;
}

/** Prefer legal Ludo progress that does not send the user's token home. */
export function friendlyLudoToken(state: LudoState, roll: number, random: RandomSource = Math.random) {
  const legal = ludoLegalTokens(state, "maya", roll);
  if (!legal.length) return undefined;
  const gentle = legal.filter((token) => {
    const next = applyLudoMove(state, "maya", token, roll);
    return next.user.every((position, index) => position === state.user[index]);
  });
  const choices = random() < .84 && gentle.length ? gentle : legal;
  return choices[Math.floor(clampUnit(random()) * choices.length)] ?? choices[0];
}

/** Maya frequently overlooks immediate wins and necessary blocks in Connect Four. */
export function friendlyConnectFourMove(board: ConnectFourBoard, random: RandomSource = Math.random) {
  const available = connectFourAvailableColumns(board);
  if (!available.length) return undefined;
  const strongest = immediateConnectFourMove(board, "M") ?? immediateConnectFourMove(board, "U");
  const softer = available.filter((column) => column !== strongest).filter((column) => {
    const next = connectFourDrop(board, column, "M");
    return immediateConnectFourMove(next, "M") === undefined;
  });
  const choices = random() < .8 && softer.length ? softer : available;
  return choices[Math.floor(clampUnit(random()) * choices.length)] ?? choices[0];
}
