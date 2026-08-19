export const MAYA_GAME_SAVE_ERROR = "This round is still playable, but Maya couldn't save it just now.";

export function reportMayaGameSaveFailure(notify: (message: string) => unknown) {
  notify(MAYA_GAME_SAVE_ERROR);
}
