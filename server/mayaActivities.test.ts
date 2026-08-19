import { describe, expect, it } from "vitest";
import { applyUserTicTacToeMove, bestTicTacToeMove, createSudoku, ticTacToeResult } from "../client/src/components/MayaActivities";

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
});
