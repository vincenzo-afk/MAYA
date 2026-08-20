import { describe, expect, it, vi } from "vitest";
import { applyMayaTheme, canSpeakWith, deliveryStatusLabel, preferredAudioMimeType, safelyCancelSpeech, selectedVoiceSettings, shouldVisuallyGroupMessages, voicePreviewText } from "../client/src/lib/mayaChatUtils";
import { shouldUseMayaAvatarFallback } from "../client/src/lib/mayaAvatarUtils";
import { closeMayaCall, prepareMayaListening, resolveMayaRecognition, stopMayaListening } from "../client/src/lib/mayaCallControls";
import { MayaContextDrawer } from "../client/src/components/MayaContextDrawer";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

describe("Maya chat speech safety", () => {
  it("does not attempt to cancel when browser speech playback is unavailable", () => {
    expect(canSpeakWith(undefined)).toBe(false);
    expect(safelyCancelSpeech(undefined)).toBe(false);
  });

  it("cancels available speech playback exactly once", () => {
    const cancel = vi.fn();
    const controller = { cancel, speak: vi.fn() };
    expect(canSpeakWith(controller)).toBe(true);
    expect(safelyCancelSpeech(controller)).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("keeps Maya's call controls safe when a browser has no speech playback engine", () => {
    const setListening = vi.fn();
    const setStatus = vi.fn();
    const setVisible = vi.fn();
    const stop = vi.fn();

    expect(prepareMayaListening(undefined)).toBe(false);
    stopMayaListening({ stop }, setListening, setStatus);
    closeMayaCall(undefined, undefined, setListening, setStatus, setVisible);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(setListening).toHaveBeenCalledWith(false);
    expect(setStatus).toHaveBeenCalledWith("ready");
    expect(setVisible).toHaveBeenCalledWith(false);
  });

  it("uses a checked fallback when neither browser recognition API is available", () => {
    const reportUnsupported = vi.fn();
    expect(resolveMayaRecognition(undefined, undefined, reportUnsupported)).toBeNull();
    expect(reportUnsupported).toHaveBeenCalledTimes(1);

    const Recognition = class {};
    expect(resolveMayaRecognition(undefined, Recognition, reportUnsupported)).toBe(Recognition);
    expect(reportUnsupported).toHaveBeenCalledTimes(1);
  });

  it("provides clear delivery copy for optimistic, failed, and delivered messages", () => {
    expect(deliveryStatusLabel("pending")).toBe("Sending");
    expect(deliveryStatusLabel("failed")).toContain("Retry");
    expect(deliveryStatusLabel(undefined)).toBe("Delivered");
  });

  it("uses a safe recorder MIME fallback when Opus is unavailable", () => {
    expect(preferredAudioMimeType((mime) => mime === "audio/webm;codecs=opus")).toBe("audio/webm;codecs=opus");
    expect(preferredAudioMimeType((mime) => mime === "audio/webm")).toBe("audio/webm");
    expect(preferredAudioMimeType(() => false)).toBeUndefined();
  });

  it("applies a selected theme immediately and groups only same-day sender messages", () => {
    const root = { dataset: {} as DOMStringMap };
    expect(applyMayaTheme(root, "ocean")).toBe("ocean");
    expect(root.dataset.mayaTheme).toBe("ocean");
    expect(shouldVisuallyGroupMessages({ role: "maya", createdAt: "2026-08-19T09:00:00Z" }, { role: "maya", createdAt: "2026-08-19T09:05:00Z" })).toBe(true);
    expect(shouldVisuallyGroupMessages({ role: "maya", createdAt: "2026-08-19T09:00:00Z" }, { role: "user", createdAt: "2026-08-19T09:05:00Z" })).toBe(false);
  });

  it("creates a voice preview that names the newly selected style", () => {
    expect(voicePreviewText("Velvet")).toContain("Velvet");
  });

  it("maps the selected voice to its playback settings and deterministic browser voice index", () => {
    expect(selectedVoiceSettings(7, 3)).toMatchObject({ styleIndex: 7, voiceIndex: 1, rate: 0.98, pitch: 1.18 });
  });

  it("uses the local Maya monogram until a valid custom avatar source becomes available", () => {
    expect(shouldUseMayaAvatarFallback(undefined)).toBe(true);
    expect(shouldUseMayaAvatarFallback("   ")).toBe(true);
    expect(shouldUseMayaAvatarFallback("https://cdn.example.com/maya.jpg")).toBe(false);
  });

  it("renders both responsive context drawer content paths", () => {
    const base = { messages: [{ id: 1, role: "maya", emotion: "joyful" }], moodEntries: [{ id: 2, checkInId: 5, mayaEmotion: "calm", userMood: "settled", createdAt: "2026-08-19T10:00:00Z" }], sessions: [{ id: 5, checkInDate: "2026-08-19" }], onDailyCheckIn: () => undefined };
    expect(renderToStaticMarkup(createElement(MayaContextDrawer, { ...base, panel: "memories" }))).toContain("What Maya remembers");
    expect(renderToStaticMarkup(createElement(MayaContextDrawer, { ...base, panel: "mood" }))).toContain("Your mood journal");
  });
});
