export type TicTacToeCell = "X" | "O" | "";

export const SUDOKU_DIFFICULTIES = { Easy: 38, Medium: 48, Hard: 56 } as const;
export type SudokuDifficulty = keyof typeof SUDOKU_DIFFICULTIES;

export const SOLUTION = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2], [6, 7, 2, 1, 9, 5, 3, 4, 8], [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3], [4, 2, 6, 8, 5, 3, 7, 9, 1], [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4], [2, 8, 7, 4, 1, 9, 6, 3, 5], [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

export function createSudoku(difficulty: SudokuDifficulty) {
  const board = SOLUTION.map((row) => [...row]);
  const cells = Array.from({ length: 81 }, (_, index) => index).sort(() => Math.random() - .5);
  cells.slice(0, SUDOKU_DIFFICULTIES[difficulty]).forEach((cell) => { board[Math.floor(cell / 9)][cell % 9] = 0; });
  return { board, givens: board.map((row) => row.map(Boolean)) };
}

const WIN_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]] as const;

export function ticTacToeResult(cells: TicTacToeCell[]) {
  const line = WIN_LINES.find(([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[b] === cells[c]);
  if (line) return cells[line[0]] as Exclude<TicTacToeCell, "">;
  return cells.every(Boolean) ? "draw" : null;
}

export function applyUserTicTacToeMove(cells: TicTacToeCell[], index: number) {
  if (cells[index] || ticTacToeResult(cells)) return cells;
  const next = [...cells];
  next[index] = "X";
  return next;
}

export function bestTicTacToeMove(cells: TicTacToeCell[]) {
  const score = (board: TicTacToeCell[], maximizing: boolean): number => {
    const result = ticTacToeResult(board);
    if (result === "O") return 10;
    if (result === "X") return -10;
    if (result === "draw") return 0;
    const free = board.map((cell, index) => cell ? -1 : index).filter((index) => index >= 0);
    const values = free.map((index) => { const next = [...board]; next[index] = maximizing ? "O" : "X"; return score(next, !maximizing); });
    return maximizing ? Math.max(...values) : Math.min(...values);
  };
  const options = cells.map((cell, index) => cell ? -1 : index).filter((index) => index >= 0);
  return options.map((index) => { const next = [...cells]; next[index] = "O"; return { index, score: score(next, false) }; }).sort((a, b) => b.score - a.score)[0]?.index;
}
