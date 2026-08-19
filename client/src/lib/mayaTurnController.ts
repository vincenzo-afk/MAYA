import type { MayaGameKind } from "./mayaGamePolicy";

export type MayaTurnTimers = {
  set: (callback: () => void, delay: number) => unknown;
  clear: (handle: unknown) => void;
};

export function createMayaTurnController(
  onThinkingChange: (game: MayaGameKind | null) => void,
  timers: MayaTurnTimers = {
    set: (callback, delay) => globalThis.setTimeout(callback, delay),
    clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
) {
  let activeTimer: unknown | null = null;
  let activeGame: MayaGameKind | null = null;

  const cancel = () => {
    if (activeTimer === null) return false;
    timers.clear(activeTimer);
    activeTimer = null;
    activeGame = null;
    onThinkingChange(null);
    return true;
  };

  const begin = (game: MayaGameKind, delay: number, completeTurn: () => void) => {
    if (activeTimer !== null) return false;
    activeGame = game;
    onThinkingChange(game);
    const timerHandle = timers.set(() => {
      if (activeTimer !== timerHandle) return;
      activeTimer = null;
      activeGame = null;
      onThinkingChange(null);
      completeTurn();
    }, delay);
    activeTimer = timerHandle;
    return true;
  };

  return { begin, cancel, isThinking: () => activeGame !== null };
}
