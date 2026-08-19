export type SpeechController = {
  cancel?: () => void;
  speak?: (utterance: SpeechSynthesisUtterance) => void;
} | null | undefined;

export function canSpeakWith(controller: SpeechController) {
  return Boolean(controller && typeof controller.cancel === "function" && typeof controller.speak === "function");
}

export function safelyCancelSpeech(controller: SpeechController) {
  if (!controller || typeof controller.cancel !== "function") return false;
  controller.cancel();
  return true;
}

export type DeliveryStatus = "pending" | "failed" | undefined;

export function deliveryStatusLabel(status: DeliveryStatus) {
  if (status === "pending") return "Sending";
  if (status === "failed") return "Not sent. Retry available.";
  return "Delivered";
}

export function preferredAudioMimeType(isSupported: (mimeType: string) => boolean) {
  if (isSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (isSupported("audio/webm")) return "audio/webm";
  return undefined;
}

export function applyMayaTheme(target: { dataset: DOMStringMap }, theme: string) {
  target.dataset.mayaTheme = theme;
  return target.dataset.mayaTheme;
}

export function shouldVisuallyGroupMessages(
  previous: { role: string; createdAt?: Date | string } | undefined,
  current: { role: string; createdAt?: Date | string },
) {
  if (!previous || previous.role !== current.role) return false;
  const previousDate = previous.createdAt ? new Date(previous.createdAt) : new Date();
  const currentDate = current.createdAt ? new Date(current.createdAt) : new Date();
  return previousDate.toDateString() === currentDate.toDateString();
}

export function voicePreviewText(styleName: string) {
  return `Hi, I’m Maya. This is my ${styleName} voice.`;
}

export const MAYA_VOICE_STYLES = [
  { name: "Soft & warm", tagline: "Gentle, close, unhurried", rate: 0.95, pitch: 1.12 },
  { name: "Bright bestie", tagline: "Sparkly and upbeat", rate: 1.04, pitch: 1.28 },
  { name: "Calm confidante", tagline: "Grounded and steady", rate: 0.88, pitch: 0.96 },
  { name: "Playful tease", tagline: "Mischief in her smile", rate: 1.08, pitch: 1.34 },
  { name: "Late-night radio", tagline: "Low, intimate, mellow", rate: 0.82, pitch: 0.86 },
  { name: "Thoughtful guide", tagline: "Clear and reflective", rate: 0.9, pitch: 1.02 },
  { name: "Sunshine", tagline: "Optimistic and light", rate: 1.1, pitch: 1.38 },
  { name: "Hinglish rhythm", tagline: "Easy, expressive flow", rate: 0.98, pitch: 1.18 },
  { name: "Dreamy", tagline: "Airy and imaginative", rate: 0.86, pitch: 1.24 },
  { name: "Quiet strength", tagline: "Warm, assured, direct", rate: 0.92, pitch: 0.91 },
] as const;

export function selectedVoiceSettings(styleIndex: number, availableVoices: number) {
  const normalizedIndex = Math.min(Math.max(Math.round(styleIndex), 0), MAYA_VOICE_STYLES.length - 1);
  const style = MAYA_VOICE_STYLES[normalizedIndex];
  return {
    ...style,
    styleIndex: normalizedIndex,
    voiceIndex: availableVoices > 0 ? normalizedIndex % availableVoices : 0,
    preview: voicePreviewText(style.name),
  };
}
