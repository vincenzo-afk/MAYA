import { Chess, type Square } from "chess.js";
import { BrainCircuit, CalendarDays, Check, ChevronLeft, Gamepad2, Grid3X3, Lightbulb, Mic, Play, RotateCcw, Sparkles, Trophy, Youtube } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import "../maya-activities.css";

type Activity = "chess" | "sudoku" | "ticTacToe" | "brainteaser" | "math" | "calendar" | "voice" | "youtube";

const PUZZLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0], [6, 0, 0, 1, 9, 5, 0, 0, 0], [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3], [4, 0, 0, 8, 0, 3, 0, 0, 1], [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0], [0, 0, 0, 4, 1, 9, 0, 0, 5], [0, 0, 0, 0, 8, 0, 0, 7, 9],
];
const SOLUTION = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2], [6, 7, 2, 1, 9, 5, 3, 4, 8], [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3], [4, 2, 6, 8, 5, 3, 7, 9, 1], [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4], [2, 8, 7, 4, 1, 9, 6, 3, 5], [3, 4, 5, 2, 8, 6, 1, 7, 9],
];
const RIDDLES = [
  { q: "I have cities, but no houses; forests, but no trees; and water, but no fish. What am I?", a: "A map." },
  { q: "What can fill a room but takes up no space?", a: "Light." },
  { q: "The more you take, the more you leave behind. What are they?", a: "Footsteps." },
];

const SUDOKU_DIFFICULTIES = { Easy: 38, Medium: 48, Hard: 56 } as const;
type SudokuDifficulty = keyof typeof SUDOKU_DIFFICULTIES;

export function createSudoku(difficulty: SudokuDifficulty) {
  const board = SOLUTION.map((row) => [...row]);
  const cells = Array.from({ length: 81 }, (_, index) => index).sort(() => Math.random() - .5);
  cells.slice(0, SUDOKU_DIFFICULTIES[difficulty]).forEach((cell) => { board[Math.floor(cell / 9)][cell % 9] = 0; });
  return { board, givens: board.map((row) => row.map(Boolean)) };
}

const piece = (symbol: string | null) => symbol ? ({ p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" }[symbol.toLowerCase() as "p"] || "") : "";

export function bestTicTacToeMove(cells: Array<"X" | "O" | "">) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = (board: typeof cells) => wins.find((line) => board[line[0]] && board[line[0]] === board[line[1]] && board[line[1]] === board[line[2]]) ? board[wins.find((line) => board[line[0]] && board[line[0]] === board[line[1]] && board[line[1]] === board[line[2]])![0]] : "";
  const score = (board: typeof cells, maximizing: boolean): number => {
    const result = winner(board); if (result === "O") return 10; if (result === "X") return -10;
    const free = board.map((cell, index) => cell ? -1 : index).filter((index) => index >= 0); if (!free.length) return 0;
    const values = free.map((index) => { const next = [...board]; next[index] = maximizing ? "O" : "X"; return score(next, !maximizing); });
    return maximizing ? Math.max(...values) : Math.min(...values);
  };
  const options = cells.map((cell, index) => cell ? -1 : index).filter((index) => index >= 0);
  return options.map((index) => { const next = [...cells]; next[index] = "O"; return { index, score: score(next, false) }; }).sort((a, b) => b.score - a.score)[0]?.index;
}

function youtubeId(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.includes("youtu.be") ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || parsed.pathname.split("/").at(-1) || ""; } catch { return ""; }
}

export function ticTacToeResult(cells: Array<"X" | "O" | "">) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const line = wins.find(([a,b,c]) => cells[a] && cells[a] === cells[b] && cells[b] === cells[c]);
  if (line) return cells[line[0]] as "X" | "O";
  return cells.every(Boolean) ? "draw" : null;
}

export function applyUserTicTacToeMove(cells: Array<"X" | "O" | "">, index: number) {
  if (cells[index] || ticTacToeResult(cells)) return cells;
  const next = [...cells];
  next[index] = "X";
  return next;
}

export default function MayaActivities({ onClose, onDiscuss }: { onClose: () => void; onDiscuss: (message: string) => void }) {
  const [activity, setActivity] = useState<Activity>("chess");
  const [fen, setFen] = useState(() => new Chess().fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [chessNote, setChessNote] = useState("I’ll take black. You open — I’m watching the center.");
  const [sudokuDifficulty, setSudokuDifficulty] = useState<SudokuDifficulty>("Easy");
  const [sudokuPack, setSudokuPack] = useState(() => createSudoku("Easy"));
  const [sudoku, setSudoku] = useState(() => sudokuPack.board.map((row) => [...row]));
  const [sudokuMessage, setSudokuMessage] = useState("Easy board loaded. Ask Maya for a hint whenever you want one.");
  const [xo, setXo] = useState<Array<"X" | "O" | "">>(Array(9).fill(""));
  const [xoNote, setXoNote] = useState("You’re X. I’ll be O — and I’m not going easy on you.");
  const [riddleIndex, setRiddleIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mathAnswer, setMathAnswer] = useState("");
  const [mathNote, setMathNote] = useState("A warm-up: what is 27 × 6?");
  const [dateValue, setDateValue] = useState("");
  const [calendarNote, setCalendarNote] = useState("Pick a date and I’ll tell you its weekday.");
  const [voiceNote, setVoiceNote] = useState("Say “Maya, let’s play” when you’re ready.");
  const [watchUrl, setWatchUrl] = useState("");
  const [watchNotes, setWatchNotes] = useState("");
  const saveGame = trpc.maya.saveGameSession.useMutation();
  const saveWatch = trpc.maya.saveYoutubeSession.useMutation();
  const chess = useMemo(() => new Chess(fen), [fen]);
  const squares = chess.board().flatMap((row) => row.map((entry) => entry));

  const save = (gameType: Exclude<Activity, "youtube">, state: Record<string, unknown>, result?: string) => saveGame.mutate({ gameType, state, result }, { onError: () => toast.error("This round is still playable, but Maya couldn't save it just now.") });

  const chessMove = (square: string) => {
    if (chess.turn() !== "w") return;
    const squarePiece = chess.get(square as Square);
    if (!selectedSquare && squarePiece?.color === "w") { setSelectedSquare(square); return; }
    if (!selectedSquare) return;
    const game = new Chess(fen);
    try {
      const move = game.move({ from: selectedSquare, to: square, promotion: "q" });
      const replies = game.moves({ verbose: true }).sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)) || (b.to === "e4" || b.to === "d4" ? 1 : 0));
      const reply = replies[0];
      if (reply) game.move(reply);
      setFen(game.fen()); setSelectedSquare(null);
      const note = reply ? `Nice ${move.san}. I answered ${reply.san}${reply.captured ? " and collected a piece" : " — I’m keeping pressure on the center"}.` : `Nice ${move.san}. The position is yours to explore.`;
      setChessNote(note); save("chess", { fen: game.fen(), lastMove: `${move.san}${reply ? ` ${reply.san}` : ""}` }, game.isGameOver() ? "complete" : undefined);
    } catch { setSelectedSquare(squarePiece?.color === "w" ? square : null); }
  };

  const editSudoku = (row: number, col: number, value: string) => {
    if (sudokuPack.givens[row][col]) return;
    const next = sudoku.map((line) => [...line]); next[row][col] = value ? Number(value.slice(-1)) : 0; setSudoku(next);
  };
  const sudokuHint = () => {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!sudoku[r][c]) { const next = sudoku.map((line) => [...line]); next[r][c] = SOLUTION[r][c]; setSudoku(next); setSudokuMessage(`Hint: row ${r + 1}, column ${c + 1} is ${SOLUTION[r][c]}.`); save("sudoku", { board: next, difficulty: sudokuDifficulty }, "hint"); return; }
  };
  const loadSudoku = (difficulty: SudokuDifficulty) => { const next = createSudoku(difficulty); setSudokuDifficulty(difficulty); setSudokuPack(next); setSudoku(next.board.map((row) => [...row])); setSudokuMessage(`${difficulty} board generated. I’m ready with gentle hints.`); save("sudoku", { board: next.board, difficulty }); };
  const validateSudoku = () => { const correct = sudoku.every((row, r) => row.every((cell, c) => cell === SOLUTION[r][c])); setSudokuMessage(correct ? "You solved it — elegant work." : "Not quite yet. Try a hint and keep going."); save("sudoku", { board: sudoku, difficulty: sudokuDifficulty }, correct ? "won" : "in-progress"); };
  const xoMove = (index: number) => {
    const next = applyUserTicTacToeMove(xo, index);
    if (next === xo) return;
    const playerResult = ticTacToeResult(next);
    if (playerResult) { setXo(next); setXoNote(playerResult === "X" ? "You won this round. Nicely played — rematch?" : "It’s a draw. That was a close one."); save("ticTacToe", { cells: next }, playerResult === "X" ? "user-won" : "draw"); return; }
    const mayaIndex = bestTicTacToeMove(next); if (mayaIndex !== undefined) next[mayaIndex] = "O";
    const result = ticTacToeResult(next);
    setXo(next); setXoNote(result === "O" ? "I won that one — but you made me earn it. Rematch?" : result === "draw" ? "It’s a draw. We read each other too well." : `I took ${["top left", "top middle", "top right", "middle left", "center", "middle right", "bottom left", "bottom middle", "bottom right"][mayaIndex!]}. Your move.`); save("ticTacToe", { cells: next }, result === "O" ? "maya-won" : result === "draw" ? "draw" : undefined);
  };
  const startVoiceGame = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { setVoiceNote("This browser doesn’t support live voice recognition. Try Chrome, or play the word prompt aloud with Maya in a call."); return; }
    const recognition = new Recognition(); recognition.lang = "en-IN"; recognition.onresult = (event: any) => { const said = event.results[0][0].transcript; const won = /maya.*let'?s play/i.test(said); setVoiceNote(won ? `I heard “${said}.” You nailed it — one point to you.` : `I heard “${said}.” So close. Try saying “Maya, let's play.”`); save("voice", { said }, won ? "won" : "try-again"); }; recognition.onerror = () => setVoiceNote("I missed that. Let’s try once more in a quieter moment."); recognition.start(); setVoiceNote("Listening… say: “Maya, let’s play.”");
  };
  const dayForDate = () => { if (!dateValue) return; const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(`${dateValue}T12:00:00`)); setCalendarNote(`${dateValue} lands on a ${weekday}. Want to make it a gentle little plan?`); save("calendar", { dateValue, weekday }); };
  const mathCheck = () => { const correct = Number(mathAnswer) === 162; setMathNote(correct ? "162 — exactly. You’re quick." : "Not quite. Tiny clue: 20 × 6 is 120, then add 7 × 6."); save("math", { answer: mathAnswer }, correct ? "won" : "try-again"); };
  const id = youtubeId(watchUrl);
  const beginWatch = () => { if (!id) { toast.error("Paste a valid YouTube link so Maya can open it with you."); return; } const context = `Maya, I’m starting a YouTube co-watch with you: ${watchUrl}. The focus I want to discuss is: ${watchNotes || "the moments that stand out and how the video makes me feel"}. Please give me one thoughtful, specific question to begin our co-watch.`; saveWatch.mutate({ videoUrl: watchUrl, title: "Maya co-watch", notes: watchNotes }, { onSuccess: () => toast.success("Saved to your private co-watch journal."), onError: () => toast.error("The video is open, but the journal entry could not be saved."), onSettled: () => onDiscuss(context) }); };

  const menu: Array<{ key: Activity; label: string; icon: typeof Gamepad2 }> = [
    { key: "chess", label: "Chess", icon: Trophy }, { key: "sudoku", label: "Sudoku", icon: Grid3X3 }, { key: "ticTacToe", label: "XO", icon: Gamepad2 }, { key: "brainteaser", label: "Brain teasers", icon: BrainCircuit }, { key: "math", label: "Math", icon: Sparkles }, { key: "calendar", label: "Calendar", icon: CalendarDays }, { key: "voice", label: "Voice game", icon: Mic }, { key: "youtube", label: "Co-watch", icon: Youtube },
  ];

  return <div className="maya-modal-backdrop maya-activity-backdrop"><section className="maya-activity-modal" aria-label="Play and watch with Maya"><button className="maya-close" onClick={onClose}><ChevronLeft size={18}/></button><header><span className="maya-eyebrow">A LITTLE WORLD FOR TWO</span><h2>Play, think, or watch with Maya.</h2><p>Every activity stays inside your private Maya space.</p></header><div className="maya-activity-layout"><nav>{menu.map((item) => { const Icon = item.icon; return <button key={item.key} className={activity === item.key ? "active" : ""} onClick={() => setActivity(item.key)}><Icon size={16}/>{item.label}</button>; })}</nav><div className="maya-game-stage">
    {activity === "chess" && <><div className="maya-stage-heading"><div><span>CHESS · YOU’RE WHITE</span><h3>One careful move at a time.</h3></div><button onClick={() => { setFen(new Chess().fen()); setSelectedSquare(null); setChessNote("Fresh board. I’m ready when you are."); }}><RotateCcw size={14}/> Reset</button></div><div className="maya-chess-board">{squares.map((entry, index) => { const rank = 8 - Math.floor(index / 8); const file = "abcdefgh"[index % 8]; const square = `${file}${rank}`; return <button key={square} onClick={() => chessMove(square)} className={`${(Math.floor(index / 8) + index) % 2 ? "dark" : "light"} ${selectedSquare === square ? "selected" : ""}`}>{entry ? <span className={entry.color === "w" ? "white" : "black"}>{piece(entry.type)}</span> : ""}</button>; })}</div><div className="maya-game-note"><Sparkles size={15}/>{chessNote}</div></>}
    {activity === "sudoku" && <><div className="maya-stage-heading"><div><span>SUDOKU · {sudokuDifficulty.toUpperCase()}</span><h3>A quiet little puzzle.</h3></div><button onClick={sudokuHint}><Lightbulb size={14}/> Hint</button></div><div className="maya-difficulty-picker">{(Object.keys(SUDOKU_DIFFICULTIES) as SudokuDifficulty[]).map((difficulty) => <button key={difficulty} className={sudokuDifficulty === difficulty ? "active" : ""} onClick={() => loadSudoku(difficulty)}>{difficulty}</button>)}</div><div className="maya-sudoku-board">{sudoku.flatMap((row, r) => row.map((cell, c) => <input key={`${r}-${c}`} aria-label={`Row ${r + 1} column ${c + 1}`} value={cell || ""} readOnly={sudokuPack.givens[r][c]} onChange={(event) => editSudoku(r, c, event.target.value)} inputMode="numeric" maxLength={1} className={sudokuPack.givens[r][c] ? "given" : ""}/>))}</div><div className="maya-stage-actions"><button onClick={validateSudoku}><Check size={14}/> Check board</button><span>{sudokuMessage}</span></div></>}
    {activity === "ticTacToe" && <><div className="maya-stage-heading"><div><span>TIC-TAC-TOE · YOU’RE X</span><h3>Playful, but strategic.</h3></div><button onClick={() => { setXo(Array(9).fill("")); setXoNote("Fresh board. You begin."); }}><RotateCcw size={14}/> Reset</button></div><div className="maya-xo-board">{xo.map((cell, index) => <button key={index} onClick={() => xoMove(index)}>{cell}</button>)}</div><div className="maya-game-note"><Sparkles size={15}/>{xoNote}</div></>}
    {activity === "brainteaser" && <><div className="maya-stage-heading"><div><span>BRAIN TEASER</span><h3>Let your mind wander a bit.</h3></div><button onClick={() => { setRiddleIndex((riddleIndex + 1) % RIDDLES.length); setShowAnswer(false); }}><RotateCcw size={14}/> Another</button></div><div className="maya-riddle"><BrainCircuit size={28}/><p>{RIDDLES[riddleIndex].q}</p><button onClick={() => { setShowAnswer(!showAnswer); save("brainteaser", { index: riddleIndex }, showAnswer ? "viewed" : undefined); }}>{showAnswer ? RIDDLES[riddleIndex].a : "Reveal Maya’s answer"}</button></div></>}
    {activity === "math" && <><div className="maya-stage-heading"><div><span>MATH MOMENT</span><h3>One little spark of focus.</h3></div></div><div className="maya-riddle"><Sparkles size={28}/><p>{mathNote}</p><div className="maya-inline-form"><input value={mathAnswer} onChange={(event) => setMathAnswer(event.target.value)} inputMode="numeric" placeholder="Your answer"/><button onClick={mathCheck}>Check</button></div></div></>}
    {activity === "calendar" && <><div className="maya-stage-heading"><div><span>CALENDAR MOMENT</span><h3>Let’s make space for what matters.</h3></div></div><div className="maya-riddle"><CalendarDays size={28}/><p>{calendarNote}</p><div className="maya-inline-form"><input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)}/><button onClick={dayForDate}>Ask Maya</button></div></div></>}
    {activity === "voice" && <><div className="maya-stage-heading"><div><span>VOICE GAME</span><h3>Say the magic words.</h3></div></div><div className="maya-riddle"><Mic size={28}/><p>{voiceNote}</p><button onClick={startVoiceGame}><Mic size={14}/> Start listening</button></div></>}
    {activity === "youtube" && <><div className="maya-stage-heading"><div><span>YOUTUBE CO-WATCH</span><h3>Press play. Bring your thoughts.</h3></div></div><div className="maya-watch-form"><input value={watchUrl} onChange={(event) => setWatchUrl(event.target.value)} placeholder="Paste a YouTube link"/><textarea value={watchNotes} onChange={(event) => setWatchNotes(event.target.value)} placeholder="What do you want Maya to notice or discuss?" rows={2}/><button onClick={beginWatch}><Play size={14}/> Start co-watch</button></div>{id ? <div className="maya-youtube-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title="Watch with Maya" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div> : <div className="maya-co-watch-empty"><Youtube size={30}/><p>Paste a link, then use the chat to ask Maya what you’re noticing, feeling, or thinking while it plays.</p></div>}</>}
  </div></div></section></div>;
}
