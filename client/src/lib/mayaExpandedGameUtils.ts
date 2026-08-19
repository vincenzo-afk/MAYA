export type Player = "user" | "maya";
export type LudoToken = -1 | number;

export type LudoState = {
  user: LudoToken[];
  maya: LudoToken[];
  turn: Player;
  winner: Player | null;
};

export const LUDO_FINISH = 58;

export function createLudoState(): LudoState {
  return { user: [-1, -1, -1, -1], maya: [-1, -1, -1, -1], turn: "user", winner: null };
}

export function ludoTrackSquare(player: Player, position: LudoToken) {
  if (position < 0 || position > 51) return null;
  return (position + (player === "maya" ? 26 : 0)) % 52;
}

export function ludoLegalTokens(state: LudoState, player: Player, roll: number) {
  if (state.turn !== player || state.winner || roll < 1 || roll > 6) return [];
  return state[player].flatMap((position, index) => {
    if (position === -1) return roll === 6 ? [index] : [];
    return position < LUDO_FINISH && position + roll <= LUDO_FINISH ? [index] : [];
  });
}

export function ludoWinner(state: LudoState): Player | null {
  if (state.user.every((token) => token === LUDO_FINISH)) return "user";
  if (state.maya.every((token) => token === LUDO_FINISH)) return "maya";
  return null;
}

export function applyLudoMove(state: LudoState, player: Player, tokenIndex: number, roll: number): LudoState {
  if (!ludoLegalTokens(state, player, roll).includes(tokenIndex)) return state;
  const own = [...state[player]];
  own[tokenIndex] = own[tokenIndex] === -1 ? 0 : own[tokenIndex] + roll;
  const otherPlayer: Player = player === "user" ? "maya" : "user";
  const other = [...state[otherPlayer]];
  const landing = ludoTrackSquare(player, own[tokenIndex]);
  if (landing !== null) {
    other.forEach((position, index) => {
      if (ludoTrackSquare(otherPlayer, position) === landing) other[index] = -1;
    });
  }
  const next = player === "user" ? { ...state, user: own, maya: other } : { ...state, maya: own, user: other };
  const winner = ludoWinner(next);
  return { ...next, winner, turn: winner ? player : roll === 6 ? player : otherPlayer };
}

export function passLudoTurn(state: LudoState): LudoState {
  if (state.winner) return state;
  return { ...state, turn: state.turn === "user" ? "maya" : "user" };
}

export type SnakesLaddersState = { user: number; maya: number; turn: Player; winner: Player | null };

export const SNAKES_AND_LADDERS: Record<number, number> = {
  4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91,
  17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78,
};

export function createSnakesLaddersState(): SnakesLaddersState {
  return { user: 0, maya: 0, turn: "user", winner: null };
}

export function resolveSnakesLaddersSquare(square: number) {
  return SNAKES_AND_LADDERS[square] ?? square;
}

export function applySnakesLaddersRoll(state: SnakesLaddersState, player: Player, roll: number): SnakesLaddersState {
  if (state.turn !== player || state.winner || roll < 1 || roll > 6) return state;
  const landing = state[player] + roll;
  const position = landing > 100 ? state[player] : resolveSnakesLaddersSquare(landing);
  const winner = position === 100 ? player : null;
  const next = { ...state, [player]: position, winner } as SnakesLaddersState;
  return { ...next, turn: winner ? player : roll === 6 ? player : player === "user" ? "maya" : "user" };
}

export type ConnectFourCell = "U" | "M" | "";
export type ConnectFourBoard = ConnectFourCell[][];

export function createConnectFourBoard(): ConnectFourBoard {
  return Array.from({ length: 6 }, () => Array<ConnectFourCell>(7).fill(""));
}

export function connectFourDrop(board: ConnectFourBoard, column: number, player: ConnectFourCell): ConnectFourBoard {
  if (player === "" || column < 0 || column > 6 || connectFourResult(board)) return board;
  const row = [...board].map((line, index) => ({ line, index })).reverse().find(({ line }) => !line[column])?.index;
  if (row === undefined) return board;
  return board.map((line, index) => index === row ? line.map((cell, col) => col === column ? player : cell) : [...line]);
}

function connectLine(board: ConnectFourBoard, row: number, col: number, rowStep: number, colStep: number) {
  const player = board[row]?.[col];
  if (!player) return false;
  return [1, 2, 3].every((step) => board[row + rowStep * step]?.[col + colStep * step] === player);
}

export function connectFourResult(board: ConnectFourBoard): "U" | "M" | "draw" | null {
  for (let row = 0; row < 6; row += 1) for (let col = 0; col < 7; col += 1) {
    if ([[0, 1], [1, 0], [1, 1], [1, -1]].some(([r, c]) => connectLine(board, row, col, r, c))) return board[row][col] as "U" | "M";
  }
  return board.every((row) => row.every(Boolean)) ? "draw" : null;
}

export function connectFourAvailableColumns(board: ConnectFourBoard) {
  return board[0].flatMap((cell, index) => cell ? [] : [index]);
}

export function immediateConnectFourMove(board: ConnectFourBoard, player: Exclude<ConnectFourCell, "">) {
  return connectFourAvailableColumns(board).find((column) => connectFourResult(connectFourDrop(board, column, player)) === player);
}

export type TileBoard = number[][];
export type TileDirection = "left" | "right" | "up" | "down";

export function create2048Board(random: () => number = Math.random): TileBoard {
  return spawn2048Tile(spawn2048Tile(Array.from({ length: 4 }, () => [0, 0, 0, 0]), random), random);
}

export function spawn2048Tile(board: TileBoard, random: () => number = Math.random): TileBoard {
  const empty = board.flatMap((row, r) => row.flatMap((cell, c) => cell ? [] : [[r, c] as const]));
  if (!empty.length) return board.map((row) => [...row]);
  const [row, col] = empty[Math.min(empty.length - 1, Math.floor(Math.max(0, Math.min(.999, random())) * empty.length))];
  return board.map((line, r) => line.map((cell, c) => r === row && c === col ? (random() < .9 ? 2 : 4) : cell));
}

function merge2048Line(line: number[]) {
  const compact = line.filter(Boolean);
  const merged: number[] = [];
  let score = 0;
  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) { const value = compact[index] * 2; merged.push(value); score += value; index += 1; } else merged.push(compact[index]);
  }
  return { line: [...merged, ...Array(4 - merged.length).fill(0)], score };
}

export function move2048(board: TileBoard, direction: TileDirection, random: () => number = Math.random) {
  const rotated = direction === "left" || direction === "right" ? board.map((row) => [...row]) : Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => board[col][row]));
  let score = 0;
  const next = rotated.map((row) => {
    const line = direction === "right" || direction === "down" ? [...row].reverse() : row;
    const result = merge2048Line(line);
    score += result.score;
    return direction === "right" || direction === "down" ? result.line.reverse() : result.line;
  });
  const returned = direction === "left" || direction === "right" ? next : Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => next[col][row]));
  const moved = returned.some((row, r) => row.some((cell, c) => cell !== board[r][c]));
  return { board: moved ? spawn2048Tile(returned, random) : returned, score, moved };
}

export function is2048GameOver(board: TileBoard) {
  if (board.flat().some((cell) => !cell)) return false;
  return !(["left", "right", "up", "down"] as TileDirection[]).some((direction) => move2048(board, direction, () => 0).moved);
}

export const WOULD_YOU_RATHER_PROMPTS = [
  "Would you rather have a slow sunrise coffee or a midnight walk with your favorite song?",
  "Would you rather revisit one happy memory or get a tiny clue about a future adventure?",
  "Would you rather be known for your kindness or your courage?",
  "Would you rather build a blanket fort for a rainy day or chase the best street-food spot in town?",
] as const;

export function nextWouldYouRatherIndex(current: number) {
  return (current + 1) % WOULD_YOU_RATHER_PROMPTS.length;
}
