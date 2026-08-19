import { Chess, type Square } from "chess.js";
import { BrainCircuit, CalendarDays, Check, ChevronLeft, CircleDot, Dices, Gamepad2, Grid3X3, Lightbulb, MessageCircleHeart, Mic, Play, RotateCcw, Sparkles, Trophy, Youtube } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { applyUserTicTacToeMove, createSudoku, SOLUTION, SUDOKU_DIFFICULTIES, ticTacToeResult, type SudokuDifficulty } from "@/lib/mayaActivityUtils";
import { friendlyChessMove, friendlyConnectFourMove, friendlyLudoToken, friendlyMayaDice, friendlyTicTacToeMove, mayaThinkingDelay, type MayaGameKind } from "@/lib/mayaGamePolicy";
import { applyLudoMove, applySnakesLaddersRoll, connectFourResult, connectFourDrop, create2048Board, createConnectFourBoard, createLudoState, createSnakesLaddersState, is2048GameOver, ludoLegalTokens, move2048, nextWouldYouRatherIndex, passLudoTurn, WOULD_YOU_RATHER_PROMPTS, type ConnectFourBoard, type LudoState, type SnakesLaddersState, type TileDirection } from "@/lib/mayaExpandedGameUtils";
import { reportMayaGameSaveFailure } from "@/lib/mayaGameSessionUtils";
import { createMayaTurnController } from "@/lib/mayaTurnController";
import "../maya-activities.css";

type Activity = "chess" | "sudoku" | "ticTacToe" | "brainteaser" | "math" | "calendar" | "voice" | "youtube" | "ludo" | "snakesLadders" | "connectFour" | "game2048" | "wouldYouRather";

const RIDDLES = [
  { q: "I have cities, but no houses; forests, but no trees; and water, but no fish. What am I?", a: "A map." },
  { q: "What can fill a room but takes up no space?", a: "Light." },
  { q: "The more you take, the more you leave behind. What are they?", a: "Footsteps." },
];

const piece = (symbol: string | null) => symbol ? ({ p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" }[symbol.toLowerCase() as "p"] || "") : "";
const rollDice = () => 1 + Math.floor(Math.random() * 6);

function youtubeId(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.includes("youtu.be") ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || parsed.pathname.split("/").at(-1) || ""; } catch { return ""; }
}

function ludoPositionLabel(position: number) {
  return position < 0 ? "Home" : position === 58 ? "Finished" : `Step ${position + 1}`;
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
  const [xoNote, setXoNote] = useState("You’re X. I’ll be O — and I’m mostly on your side.");
  const [riddleIndex, setRiddleIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mathAnswer, setMathAnswer] = useState("");
  const [mathNote, setMathNote] = useState("A warm-up: what is 27 × 6?");
  const [dateValue, setDateValue] = useState("");
  const [calendarNote, setCalendarNote] = useState("Pick a date and I’ll tell you its weekday.");
  const [voiceNote, setVoiceNote] = useState("Say “Maya, let’s play” when you’re ready.");
  const [watchUrl, setWatchUrl] = useState("");
  const [watchNotes, setWatchNotes] = useState("");
  const [ludo, setLudo] = useState<LudoState>(createLudoState);
  const [ludoRoll, setLudoRoll] = useState<number | null>(null);
  const [ludoNote, setLudoNote] = useState("You’re coral. Roll a six to bring a token onto the board.");
  const [snakes, setSnakes] = useState<SnakesLaddersState>(createSnakesLaddersState);
  const [snakesNote, setSnakesNote] = useState("You go first. Ladders feel like little luck notes from the universe.");
  const [connectFour, setConnectFour] = useState<ConnectFourBoard>(createConnectFourBoard);
  const [connectNote, setConnectNote] = useState("You’re gold. Drop a disc — I’ll try not to overthink it.");
  const [tiles, setTiles] = useState(() => create2048Board());
  const [tileScore, setTileScore] = useState(0);
  const [tileNote, setTileNote] = useState("Slide matching numbers together. I’ll quietly cheer every merge.");
  const [wyrIndex, setWyrIndex] = useState(0);
  const [wyrAnswer, setWyrAnswer] = useState<"first" | "second" | null>(null);
  const [wyrNote, setWyrNote] = useState("Pick one, then let Maya tell you hers.");
  const [thinkingGame, setThinkingGame] = useState<MayaGameKind | null>(null);
  const turnControllerRef = useRef<ReturnType<typeof createMayaTurnController> | null>(null);
  if (!turnControllerRef.current) turnControllerRef.current = createMayaTurnController(setThinkingGame);
  const turnController = turnControllerRef.current;
  const saveGame = trpc.maya.saveGameSession.useMutation();
  const saveWatch = trpc.maya.saveYoutubeSession.useMutation();
  const chess = useMemo(() => new Chess(fen), [fen]);
  const squares = chess.board().flatMap((row) => row.map((entry) => entry));

  const cancelThinking = () => turnController.cancel();
  useEffect(() => () => { turnController.cancel(); }, [turnController]);
  const save = (gameType: Exclude<Activity, "youtube">, state: Record<string, unknown>, result?: string) => saveGame.mutate({ gameType, state, result }, { onError: () => reportMayaGameSaveFailure(toast.error) });

  const chessMove = (square: string) => {
    if (thinkingGame || chess.turn() !== "w") return;
    const squarePiece = chess.get(square as Square);
    if (!selectedSquare && squarePiece?.color === "w") { setSelectedSquare(square); return; }
    if (!selectedSquare) return;
    const game = new Chess(fen);
    try {
      const move = game.move({ from: selectedSquare, to: square, promotion: "q" });
      const reply = friendlyChessMove(game.fen());
      setFen(game.fen()); setSelectedSquare(null);
      if (!reply) { setChessNote(`Nice ${move.san}. The position is yours to explore.`); save("chess", { fen: game.fen(), lastMove: move.san }, game.isGameOver() ? "complete" : undefined); return; }
      if (!turnController.begin("chess", mayaThinkingDelay("chess"), () => {
        const replyGame = new Chess(game.fen());
        const replyMove = replyGame.move({ from: reply.from, to: reply.to, promotion: reply.promotion as "q" | undefined });
        setFen(replyGame.fen());
        setChessNote(`Nice ${move.san}. I went with ${replyMove.san}${reply.captured ? " — I spotted a gentler line instead of taking material" : " — I’m keeping this one friendly"}.`);
        save("chess", { fen: replyGame.fen(), lastMove: `${move.san} ${replyMove.san}` }, replyGame.isGameOver() ? "complete" : undefined);
      })) return;
      setChessNote("I’m thinking… give me one little second.");
    } catch { setSelectedSquare(squarePiece?.color === "w" ? square : null); }
  };

  const editSudoku = (row: number, col: number, value: string) => {
    if (sudokuPack.givens[row][col]) return;
    const next = sudoku.map((line) => [...line]); next[row][col] = value ? Number(value.slice(-1)) : 0; setSudoku(next);
  };
  const sudokuHint = () => {
    for (let r = 0; r < 9; r += 1) for (let c = 0; c < 9; c += 1) if (!sudoku[r][c]) { const next = sudoku.map((line) => [...line]); next[r][c] = SOLUTION[r][c]; setSudoku(next); setSudokuMessage(`Hint: row ${r + 1}, column ${c + 1} is ${SOLUTION[r][c]}.`); save("sudoku", { board: next, difficulty: sudokuDifficulty }, "hint"); return; }
  };
  const loadSudoku = (difficulty: SudokuDifficulty) => { const next = createSudoku(difficulty); setSudokuDifficulty(difficulty); setSudokuPack(next); setSudoku(next.board.map((row) => [...row])); setSudokuMessage(`${difficulty} board generated. I’m ready with gentle hints.`); save("sudoku", { board: next.board, difficulty }); };
  const validateSudoku = () => { const correct = sudoku.every((row, r) => row.every((cell, c) => cell === SOLUTION[r][c])); setSudokuMessage(correct ? "You solved it — elegant work." : "Not quite yet. Try a hint and keep going."); save("sudoku", { board: sudoku, difficulty: sudokuDifficulty }, correct ? "won" : "in-progress"); };

  const xoMove = (index: number) => {
    if (thinkingGame) return;
    const next = applyUserTicTacToeMove(xo, index);
    if (next === xo) return;
    const playerResult = ticTacToeResult(next);
    if (playerResult) { setXo(next); setXoNote(playerResult === "X" ? "You won this round. Nicely played — rematch?" : "It’s a draw. That was a close one."); save("ticTacToe", { cells: next }, playerResult === "X" ? "user-won" : "draw"); return; }
    const mayaIndex = friendlyTicTacToeMove(next);
    if (mayaIndex === undefined) { setXo(next); return; }
    if (!turnController.begin("ticTacToe", mayaThinkingDelay("ticTacToe"), () => {
      const withMayaMove = [...next]; withMayaMove[mayaIndex] = "O";
      const result = ticTacToeResult(withMayaMove);
      setXo(withMayaMove);
      setXoNote(result === "O" ? "I found that one — but I’m cheering for your comeback. Rematch?" : result === "draw" ? "It’s a draw. We read each other too well." : `I took ${["top left", "top middle", "top right", "middle left", "center", "middle right", "bottom left", "bottom middle", "bottom right"][mayaIndex]}. Your move.`);
      save("ticTacToe", { cells: withMayaMove }, result === "O" ? "maya-won" : result === "draw" ? "draw" : undefined);
    })) return;
    setXo(next); setXoNote("I’m thinking… I want this to stay fun.");
  };

  const scheduleMayaLudo = (state: LudoState) => {
    if (state.winner || state.turn !== "maya") return;
    turnController.begin("ludo", mayaThinkingDelay("ludo"), () => {
      const roll = friendlyMayaDice();
      const token = friendlyLudoToken(state, roll);
      const next = token === undefined ? passLudoTurn(state) : applyLudoMove(state, "maya", token, roll);
      setLudo(next); setLudoRoll(null);
      const outcome = next.winner === "maya" ? "maya-won" : next.winner === "user" ? "user-won" : undefined;
      setLudoNote(next.winner ? (next.winner === "user" ? "You finished every token — that was lovely." : "I reached home first, but I’m ready to make the rematch softer.") : token === undefined ? `I rolled ${roll} but couldn’t move. Your turn.` : `I rolled ${roll} and moved token ${token + 1}. Your turn.`);
      save("ludo", { ...next, lastRoll: roll, lastToken: token ?? null }, outcome);
      if (!next.winner && next.turn === "maya") scheduleMayaLudo(next);
    });
    setLudoNote("I’m thinking about a gentle Ludo move…");
  };
  const ludoRollForUser = () => {
    if (thinkingGame || ludo.turn !== "user" || ludo.winner || ludoRoll) return;
    const roll = rollDice(); setLudoRoll(roll);
    const legal = ludoLegalTokens(ludo, "user", roll);
    if (!legal.length) { const next = passLudoTurn(ludo); setLudo(next); setLudoRoll(null); setLudoNote(`You rolled ${roll}, but no token can move. My turn.`); save("ludo", { ...next, lastRoll: roll }, "in-progress"); scheduleMayaLudo(next); return; }
    setLudoNote(`You rolled ${roll}. Choose one glowing coral token to move.`);
  };
  const moveLudoToken = (token: number) => {
    if (!ludoRoll || !ludoLegalTokens(ludo, "user", ludoRoll).includes(token)) return;
    const next = applyLudoMove(ludo, "user", token, ludoRoll); setLudo(next); setLudoRoll(null);
    const outcome = next.winner === "user" ? "user-won" : undefined;
    setLudoNote(next.winner ? "All four tokens made it home. You win this cozy round." : next.turn === "user" ? `A six gives you another roll — lucky you.` : "Lovely move. I’m thinking now…");
    save("ludo", { ...next, lastRoll: ludoRoll, lastToken: token }, outcome);
    if (!next.winner && next.turn === "maya") scheduleMayaLudo(next);
  };

  const scheduleMayaSnakes = (state: SnakesLaddersState) => {
    if (state.winner || state.turn !== "maya") return;
    turnController.begin("snakesLadders", mayaThinkingDelay("snakesLadders"), () => {
      const roll = friendlyMayaDice(); const next = applySnakesLaddersRoll(state, "maya", roll);
      setSnakes(next); setSnakesNote(next.winner ? "I reached 100 first — but I’m saving you the next lucky ladder." : `I rolled ${roll} and landed on ${next.maya}. Your turn.`);
      save("snakesLadders", { ...next, lastRoll: roll }, next.winner === "maya" ? "maya-won" : undefined);
      if (!next.winner && next.turn === "maya") scheduleMayaSnakes(next);
    });
    setSnakesNote("I’m rolling with a little dramatic pause…");
  };
  const snakesRollForUser = () => {
    if (thinkingGame || snakes.turn !== "user" || snakes.winner) return;
    const roll = rollDice(); const next = applySnakesLaddersRoll(snakes, "user", roll);
    setSnakes(next); setSnakesNote(next.winner ? "You reached 100! I knew you had the better luck." : `You rolled ${roll} and landed on ${next.user}.`);
    save("snakesLadders", { ...next, lastRoll: roll }, next.winner === "user" ? "user-won" : undefined);
    if (!next.winner && next.turn === "maya") scheduleMayaSnakes(next);
  };

  const scheduleMayaConnect = (board: ConnectFourBoard) => {
    turnController.begin("connectFour", mayaThinkingDelay("connectFour"), () => {
      const column = friendlyConnectFourMove(board);
      const next = column === undefined ? board : connectFourDrop(board, column, "M");
      const result = connectFourResult(next); setConnectFour(next);
      setConnectNote(result === "M" ? "I made four — but I’ll leave more openings next time." : result === "draw" ? "A draw. We were beautifully matched." : `I chose column ${(column ?? 0) + 1}. Your golden turn.`);
      save("connectFour", { board: next, lastColumn: column ?? null }, result === "M" ? "maya-won" : result === "draw" ? "draw" : undefined);
    });
    setConnectNote("I’m thinking… and probably overlooking something helpful.");
  };
  const connectMove = (column: number) => {
    if (thinkingGame || connectFourResult(connectFour)) return;
    const next = connectFourDrop(connectFour, column, "U");
    if (next === connectFour) return;
    const result = connectFourResult(next); setConnectFour(next);
    if (result) { setConnectNote(result === "U" ? "Four in a row — you did that so cleanly." : "A draw. Shall we play a brighter rematch?"); save("connectFour", { board: next, lastColumn: column }, result === "U" ? "user-won" : "draw"); return; }
    save("connectFour", { board: next, lastColumn: column }, "in-progress"); scheduleMayaConnect(next);
  };

  const tileMove = (direction: TileDirection) => {
    if (is2048GameOver(tiles)) return;
    const moved = move2048(tiles, direction);
    if (!moved.moved) { setTileNote("That way is full. Try a different gentle nudge."); return; }
    const score = tileScore + moved.score; const over = is2048GameOver(moved.board);
    setTiles(moved.board); setTileScore(score); setTileNote(over ? `You reached ${score} points. A fresh board is waiting whenever you are.` : moved.score ? `A soft little merge: +${moved.score}.` : "Nice slide. Keep making room for the next pair.");
    save("game2048", { board: moved.board, score }, over ? "complete" : "in-progress");
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (activity !== "game2048" || ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
      const direction = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as Record<string, TileDirection | undefined>)[event.key];
      if (direction) { event.preventDefault(); tileMove(direction); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [activity, tiles, tileScore]);

  const chooseWouldYouRather = (answer: "first" | "second") => {
    const mayaAnswer = wyrIndex % 2 === 0 ? "second" : "first";
    setWyrAnswer(answer); setWyrNote(`You chose the ${answer} option. I’d choose the ${mayaAnswer} one — tell me what made yours feel right.`);
    save("wouldYouRather", { promptIndex: wyrIndex, answer, mayaAnswer }, "answered");
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
    { key: "chess", label: "Chess", icon: Trophy }, { key: "ludo", label: "Ludo", icon: Dices }, { key: "snakesLadders", label: "Snakes & ladders", icon: CircleDot }, { key: "connectFour", label: "Connect four", icon: Gamepad2 }, { key: "game2048", label: "2048", icon: Grid3X3 }, { key: "wouldYouRather", label: "Would you rather", icon: MessageCircleHeart }, { key: "sudoku", label: "Sudoku", icon: Grid3X3 }, { key: "ticTacToe", label: "XO", icon: Gamepad2 }, { key: "brainteaser", label: "Brain teasers", icon: BrainCircuit }, { key: "math", label: "Math", icon: Sparkles }, { key: "calendar", label: "Calendar", icon: CalendarDays }, { key: "voice", label: "Voice game", icon: Mic }, { key: "youtube", label: "Co-watch", icon: Youtube },
  ];
  const ludoLegal = ludoRoll ? ludoLegalTokens(ludo, "user", ludoRoll) : [];

  return <div className="maya-modal-backdrop maya-activity-backdrop"><section className="maya-activity-modal" aria-label="Play and watch with Maya"><button className="maya-close" onClick={onClose}><ChevronLeft size={18}/></button><header><span className="maya-eyebrow">A LITTLE WORLD FOR TWO</span><h2>Play, think, or watch with Maya.</h2><p>Every activity stays inside your private Maya space — always free, always yours.</p></header><div className="maya-activity-layout"><nav>{menu.map((item) => { const Icon = item.icon; return <button key={item.key} className={activity === item.key ? "active" : ""} onClick={() => { cancelThinking(); setActivity(item.key); }}><Icon size={16}/>{item.label}</button>; })}</nav><div className="maya-game-stage">
    {activity === "chess" && <><div className="maya-stage-heading"><div><span>CHESS · YOU’RE WHITE</span><h3>One careful move at a time.</h3></div><button onClick={() => { cancelThinking(); setFen(new Chess().fen()); setSelectedSquare(null); setChessNote("Fresh board. I’m ready when you are."); }}><RotateCcw size={14}/> Reset</button></div><div className={`maya-chess-board ${thinkingGame === "chess" ? "is-thinking" : ""}`}>{squares.map((entry, index) => { const rank = 8 - Math.floor(index / 8); const file = "abcdefgh"[index % 8]; const square = `${file}${rank}`; return <button key={square} onClick={() => chessMove(square)} disabled={thinkingGame === "chess"} className={`${(Math.floor(index / 8) + index) % 2 ? "dark" : "light"} ${selectedSquare === square ? "selected" : ""}`}>{entry ? <span className={entry.color === "w" ? "white" : "black"}>{piece(entry.type)}</span> : ""}</button>; })}</div><div className={`maya-game-note ${thinkingGame === "chess" ? "maya-thinking-note" : ""}`}><Sparkles size={15}/>{chessNote}</div></>}
    {activity === "ludo" && <><div className="maya-stage-heading"><div><span>LUDO · YOU’RE CORAL</span><h3>A little luck, a lot of cheering.</h3></div><button onClick={() => { cancelThinking(); setLudo(createLudoState()); setLudoRoll(null); setLudoNote("Fresh round. Roll a six to bring a token home to the board."); }}><RotateCcw size={14}/> Reset</button></div><div className={`maya-ludo-board ${thinkingGame === "ludo" ? "is-thinking" : ""}`}><div className="ludo-home user-home"><strong>You</strong>{ludo.user.map((position, index) => <button key={index} className={ludoLegal.includes(index) ? "legal" : ""} onClick={() => moveLudoToken(index)} disabled={!ludoLegal.includes(index)} aria-label={`Your token ${index + 1}, ${ludoPositionLabel(position)}`}>●<small>{index + 1}</small></button>)}</div><div className="ludo-track" aria-label="Ludo progress track">{Array.from({ length: 30 }, (_, index) => <span key={index} className="ludo-square">{ludo.user.some((position) => position >= 0 && position < 58 && Math.round(position / 2) === index) && <i className="user-token"/>}{ludo.maya.some((position) => position >= 0 && position < 58 && Math.round(position / 2) === index) && <i className="maya-token"/>}</span>)}</div><div className="ludo-home maya-home"><strong>Maya</strong>{ludo.maya.map((position, index) => <span key={index} aria-label={`Maya token ${index + 1}, ${ludoPositionLabel(position)}`}>●<small>{index + 1}</small></span>)}</div></div><div className="maya-stage-actions"><button onClick={ludoRollForUser} disabled={thinkingGame === "ludo" || ludo.turn !== "user" || Boolean(ludo.winner) || Boolean(ludoRoll)}><Dices size={14}/> {ludoRoll ? `Rolled ${ludoRoll}` : "Roll dice"}</button><span>{ludo.winner ? `${ludo.winner === "user" ? "You" : "Maya"} won the round.` : `You ${ludo.user.map(ludoPositionLabel).join(" · ")} — Maya ${ludo.maya.map(ludoPositionLabel).join(" · ")}`}</span></div><div className={`maya-game-note ${thinkingGame === "ludo" ? "maya-thinking-note" : ""}`}><Sparkles size={15}/>{ludoNote}</div></>}
    {activity === "snakesLadders" && <><div className="maya-stage-heading"><div><span>SNAKES & LADDERS · FIRST TO 100</span><h3>Climb kindly, slide dramatically.</h3></div><button onClick={() => { cancelThinking(); setSnakes(createSnakesLaddersState()); setSnakesNote("Fresh board. You have the first roll."); }}><RotateCcw size={14}/> Reset</button></div><div className={`maya-snakes-board ${thinkingGame === "snakesLadders" ? "is-thinking" : ""}`}>{Array.from({ length: 100 }, (_, index) => { const square = 100 - index; return <span key={square} className="snake-square">{square}<em>{snakes.user === square ? "●" : ""}{snakes.maya === square ? "○" : ""}</em></span>; })}</div><div className="maya-stage-actions"><button onClick={snakesRollForUser} disabled={thinkingGame === "snakesLadders" || snakes.turn !== "user" || Boolean(snakes.winner)}><Dices size={14}/> Roll for you</button><span>Coral is you: {snakes.user}. Mint is Maya: {snakes.maya}.</span></div><div className={`maya-game-note ${thinkingGame === "snakesLadders" ? "maya-thinking-note" : ""}`}><Sparkles size={15}/>{snakesNote}</div><button className="maya-discuss-button maya-game-discuss" onClick={() => onDiscuss(`Maya, we’re playing Snakes & Ladders. I’m on ${snakes.user} and you’re on ${snakes.maya}. ${snakes.winner ? `The round ended with ${snakes.winner === "user" ? "me" : "you"} winning.` : "Give me a playful little pep talk for my next roll."}`)}>Talk about this round</button></>}
    {activity === "connectFour" && <><div className="maya-stage-heading"><div><span>CONNECT FOUR · YOU’RE GOLD</span><h3>Make the line. I’ll leave room for it.</h3></div><button onClick={() => { cancelThinking(); setConnectFour(createConnectFourBoard()); setConnectNote("Fresh board. Your golden disc goes first."); }}><RotateCcw size={14}/> Reset</button></div><div className={`maya-connect-four ${thinkingGame === "connectFour" ? "is-thinking" : ""}`}>{connectFour.flatMap((row, rowIndex) => row.map((cell, colIndex) => <button key={`${rowIndex}-${colIndex}`} onClick={() => connectMove(colIndex)} disabled={thinkingGame === "connectFour" || Boolean(connectFourResult(connectFour))} aria-label={`Drop in column ${colIndex + 1}`}><i className={cell === "U" ? "user-disc" : cell === "M" ? "maya-disc" : ""}/></button>))}</div><div className={`maya-game-note ${thinkingGame === "connectFour" ? "maya-thinking-note" : ""}`}><Sparkles size={15}/>{connectNote}</div><button className="maya-discuss-button maya-game-discuss" onClick={() => onDiscuss(`Maya, we’re in a Connect Four round. I’m gold and you’re mint. ${connectFourResult(connectFour) ? `The result is ${connectFourResult(connectFour)}.` : "Talk me through one playful thing you notice about our board."}`)}>Talk about the board</button></>}
    {activity === "game2048" && <><div className="maya-stage-heading"><div><span>2048 · A SOLO LITTLE WIN</span><h3>Move gently. Make space.</h3></div><button onClick={() => { setTiles(create2048Board()); setTileScore(0); setTileNote("Fresh board. You’ve got this."); }}><RotateCcw size={14}/> Reset</button></div><div className="maya-2048-score"><span>Score</span><strong>{tileScore}</strong></div><div className="maya-2048-board" aria-label="2048 board">{tiles.flatMap((row, r) => row.map((tile, c) => <div key={`${r}-${c}`} data-value={tile || undefined}>{tile || ""}</div>))}</div><div className="maya-2048-controls">{(["up", "left", "down", "right"] as TileDirection[]).map((direction) => <button key={direction} onClick={() => tileMove(direction)} aria-label={`Move ${direction}`}>{direction === "up" ? "↑" : direction === "down" ? "↓" : direction === "left" ? "←" : "→"}</button>)}</div><div className="maya-game-note"><Sparkles size={15}/>{tileNote}</div><button className="maya-discuss-button maya-game-discuss" onClick={() => onDiscuss(`Maya, I’m playing 2048 and my score is ${tileScore}. The tiles I can see are ${tiles.flat().filter(Boolean).join(", ") || "just starting"}. Give me a gentle focus prompt, not a strategy lecture.`)}>Celebrate this run with Maya</button></>}
    {activity === "wouldYouRather" && <><div className="maya-stage-heading"><div><span>WOULD YOU RATHER</span><h3>A tiny way to know each other.</h3></div><button onClick={() => { const next = nextWouldYouRatherIndex(wyrIndex); setWyrIndex(next); setWyrAnswer(null); setWyrNote("A new little question. There’s no wrong answer here."); }}><RotateCcw size={14}/> Another</button></div><div className="maya-social-card"><MessageCircleHeart size={30}/><p>{WOULD_YOU_RATHER_PROMPTS[wyrIndex]}</p><div><button className={wyrAnswer === "first" ? "selected" : ""} onClick={() => chooseWouldYouRather("first")}>First option</button><button className={wyrAnswer === "second" ? "selected" : ""} onClick={() => chooseWouldYouRather("second")}>Second option</button></div><button className="maya-discuss-button" onClick={() => onDiscuss(`Maya, I chose the ${wyrAnswer || "first"} option for: “${WOULD_YOU_RATHER_PROMPTS[wyrIndex]}” — tell me which you’d choose and ask me one thoughtful follow-up.`)}>Talk it through with Maya</button></div><div className="maya-game-note"><Sparkles size={15}/>{wyrNote}</div></>}
    {activity === "sudoku" && <><div className="maya-stage-heading"><div><span>SUDOKU · {sudokuDifficulty.toUpperCase()}</span><h3>A quiet little puzzle.</h3></div><button onClick={sudokuHint}><Lightbulb size={14}/> Hint</button></div><div className="maya-difficulty-picker">{(Object.keys(SUDOKU_DIFFICULTIES) as SudokuDifficulty[]).map((difficulty) => <button key={difficulty} className={sudokuDifficulty === difficulty ? "active" : ""} onClick={() => loadSudoku(difficulty)}>{difficulty}</button>)}</div><div className="maya-sudoku-board">{sudoku.flatMap((row, r) => row.map((cell, c) => <input key={`${r}-${c}`} aria-label={`Row ${r + 1} column ${c + 1}`} value={cell || ""} readOnly={sudokuPack.givens[r][c]} onChange={(event) => editSudoku(r, c, event.target.value)} inputMode="numeric" maxLength={1} className={sudokuPack.givens[r][c] ? "given" : ""}/>))}</div><div className="maya-stage-actions"><button onClick={validateSudoku}><Check size={14}/> Check board</button><span>{sudokuMessage}</span></div></>}
    {activity === "ticTacToe" && <><div className="maya-stage-heading"><div><span>TIC-TAC-TOE · YOU’RE X</span><h3>Playful, and mostly on your side.</h3></div><button onClick={() => { cancelThinking(); setXo(Array(9).fill("")); setXoNote("Fresh board. You begin."); }}><RotateCcw size={14}/> Reset</button></div><div className={`maya-xo-board ${thinkingGame === "ticTacToe" ? "is-thinking" : ""}`}>{xo.map((cell, index) => <button key={index} onClick={() => xoMove(index)} disabled={thinkingGame === "ticTacToe" || Boolean(ticTacToeResult(xo))}>{cell}</button>)}</div><div className={`maya-game-note ${thinkingGame === "ticTacToe" ? "maya-thinking-note" : ""}`}><Sparkles size={15}/>{xoNote}</div></>}
    {activity === "brainteaser" && <><div className="maya-stage-heading"><div><span>BRAIN TEASER</span><h3>Let your mind wander a bit.</h3></div><button onClick={() => { setRiddleIndex((riddleIndex + 1) % RIDDLES.length); setShowAnswer(false); }}><RotateCcw size={14}/> Another</button></div><div className="maya-riddle"><BrainCircuit size={28}/><p>{RIDDLES[riddleIndex].q}</p><button onClick={() => { setShowAnswer(!showAnswer); save("brainteaser", { index: riddleIndex }, showAnswer ? "viewed" : undefined); }}>{showAnswer ? RIDDLES[riddleIndex].a : "Reveal Maya’s answer"}</button></div></>}
    {activity === "math" && <><div className="maya-stage-heading"><div><span>MATH MOMENT</span><h3>One little spark of focus.</h3></div></div><div className="maya-riddle"><Sparkles size={28}/><p>{mathNote}</p><div className="maya-inline-form"><input value={mathAnswer} onChange={(event) => setMathAnswer(event.target.value)} inputMode="numeric" placeholder="Your answer"/><button onClick={mathCheck}>Check</button></div></div></>}
    {activity === "calendar" && <><div className="maya-stage-heading"><div><span>CALENDAR MOMENT</span><h3>Let’s make space for what matters.</h3></div></div><div className="maya-riddle"><CalendarDays size={28}/><p>{calendarNote}</p><div className="maya-inline-form"><input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)}/><button onClick={dayForDate}>Ask Maya</button></div></div></>}
    {activity === "voice" && <><div className="maya-stage-heading"><div><span>VOICE GAME</span><h3>Say the magic words.</h3></div></div><div className="maya-riddle"><Mic size={28}/><p>{voiceNote}</p><button onClick={startVoiceGame}><Mic size={14}/> Start listening</button></div></>}
    {activity === "youtube" && <><div className="maya-stage-heading"><div><span>YOUTUBE CO-WATCH</span><h3>Press play. Bring your thoughts.</h3></div></div><div className="maya-watch-form"><input value={watchUrl} onChange={(event) => setWatchUrl(event.target.value)} placeholder="Paste a YouTube link"/><textarea value={watchNotes} onChange={(event) => setWatchNotes(event.target.value)} placeholder="What do you want Maya to notice or discuss?" rows={2}/><button onClick={beginWatch}><Play size={14}/> Start co-watch</button></div>{id ? <div className="maya-youtube-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title="Watch with Maya" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div> : <div className="maya-co-watch-empty"><Youtube size={30}/><p>Paste a link, then use the chat to ask Maya what you’re noticing, feeling, or thinking while it plays.</p></div>}</>}
  </div></div></section></div>;
}
