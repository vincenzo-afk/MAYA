import { safelyCancelSpeech, type SpeechController } from "./mayaChatUtils";

export type SpeechRecognitionController = { stop?: () => void } | null | undefined;
export type SpeechRecognitionConstructor = new () => any;

export function resolveMayaRecognition(
  speechRecognition: unknown,
  webkitSpeechRecognition: unknown,
  reportUnsupported: () => void,
): SpeechRecognitionConstructor | null {
  const Recognition = typeof speechRecognition === "function" ? speechRecognition : typeof webkitSpeechRecognition === "function" ? webkitSpeechRecognition : null;
  if (!Recognition) {
    reportUnsupported();
    return null;
  }
  return Recognition as SpeechRecognitionConstructor;
}

export function prepareMayaListening(speech: SpeechController) {
  return safelyCancelSpeech(speech);
}

export function stopMayaListening(
  recognition: SpeechRecognitionController,
  setListening: (listening: boolean) => void,
  setStatus: (status: "ready") => void,
) {
  recognition?.stop?.();
  setListening(false);
  setStatus("ready");
}

export function closeMayaCall(
  recognition: SpeechRecognitionController,
  speech: SpeechController,
  setListening: (listening: boolean) => void,
  setStatus: (status: "ready") => void,
  setVisible: (visible: boolean) => void,
) {
  stopMayaListening(recognition, setListening, setStatus);
  safelyCancelSpeech(speech);
  setVisible(false);
}
