import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import MayaActivities from "@/components/MayaActivities";
import { MayaContextDrawer } from "@/components/MayaContextDrawer";
import { trpc } from "@/lib/trpc";
import { shouldUseMayaAvatarFallback } from "@/lib/mayaAvatarUtils";
import { closeMayaCall, prepareMayaListening, resolveMayaRecognition, stopMayaListening } from "@/lib/mayaCallControls";
import { applyMayaTheme, canSpeakWith, deliveryStatusLabel, MAYA_VOICE_STYLES, preferredAudioMimeType, safelyCancelSpeech, selectedVoiceSettings, shouldVisuallyGroupMessages } from "@/lib/mayaChatUtils";
import { COOKIE_NAME } from "@shared/const";
import {
  ArrowUp,
  CheckCheck,
  ChevronRight,
  CircleDot,
  Clock3,
  Heart,
  Info,
  Lightbulb,
  Loader2,
  MessageCircleHeart,
  Mic,
  MicOff,
  MoreHorizontal,
  Palette,
  Phone,
  Play,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const EMOJI_REACTIONS = ["♥", "😊", "✨", "😂", "🥹"];
const GIF_CHOICES = [
  { label: "Happy dance", url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif" },
  { label: "Big hug", url: "https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif" },
  { label: "Sparkle", url: "https://media.giphy.com/media/26gsspfbt1HfVQ9va/giphy.gif" },
];
const STICKER_CHOICES = ["🌷", "🫶", "☕", "🪩", "🌙", "🐣", "💌", "🎧"];

type LocalMessage = {
  id: number;
  role: "user" | "maya";
  kind: "text" | "voice" | "photo" | "activity";
  content: string;
  mediaUrl?: string | null;
  emotion?: string | null;
  emotionIntensity?: number | null;
  reactions?: string[] | null;
  createdAt?: Date | string;
  status?: "pending" | "failed";
};

type ContextPanel = "chat" | "memories" | "mood";
type ThemeName = "violet" | "rose" | "ocean" | "sunset";

function shortTime(value?: Date | string) {
  if (!value) return "now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "now" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(value?: Date | string) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function dayKey(value?: Date | string) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? "today" : date.toDateString();
}

function cleanForSpeech(text: string) {
  return text.replace(/[*_`#]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

function Avatar({ src, mood = "calm", size = "md" }: { src?: string | null; mood?: string | null; size?: "sm" | "md" | "lg" }) {
  const [imageUnavailable, setImageUnavailable] = useState(() => shouldUseMayaAvatarFallback(src));
  const dimensions = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-32 w-32" : "h-12 w-12";
  const monogramSize = size === "sm" ? "text-base" : size === "lg" ? "text-5xl" : "text-xl";
  useEffect(() => setImageUnavailable(shouldUseMayaAvatarFallback(src)), [src]);
  return <div className={`relative shrink-0 ${dimensions}`}>
    {imageUnavailable ? (
      <div role="img" aria-label="Maya" className={`grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-emerald-200 via-teal-300 to-cyan-500 font-serif ${monogramSize} font-bold tracking-[-0.08em] text-slate-950 shadow-inner`}>M</div>
    ) : (
      <img src={src || undefined} alt="Maya" onError={() => setImageUnavailable(true)} className="h-full w-full rounded-full object-cover" />
    )}
    <span className={`maya-mood-dot maya-mood-${mood?.toLowerCase() || "calm"}`} />
  </div>;
}

export default function MayaCompanion() {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const bootstrap = trpc.maya.bootstrap.useQuery(undefined, { enabled: isAuthenticated });
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [activePanel, setActivePanel] = useState<ContextPanel>("chat");
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>("violet");
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [reactionTarget, setReactionTarget] = useState<number | null>(null);
  const [callTranscript, setCallTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [callStatus, setCallStatus] = useState<"ready" | "listening" | "thinking" | "speaking">("ready");
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voiceMutation = trpc.maya.processVoiceNote.useMutation();
  const reactionMutation = trpc.maya.setReaction.useMutation();
  const mediaMutation = trpc.maya.sendMedia.useMutation();
  const dailyCheckInMutation = trpc.maya.openDailyCheckIn.useMutation();
  const preferencesMutation = trpc.maya.updatePreferences.useMutation();

  const mayaPhoto = bootstrap.data?.preferences?.displayPhoto;
  const latestMaya = [...messages].reverse().find((message) => message.role === "maya");
  const activeMood = latestMaya?.emotion || "calm";
  const userFirstName = user?.name?.split(" ")[0] || "there";
  const chatPreview = messages.length ? messages[messages.length - 1].content || "Maya is writing…" : "Tap to start a private conversation";

  useEffect(() => {
    if (bootstrap.data?.messages) setMessages(bootstrap.data.messages as LocalMessage[]);
    if (bootstrap.data?.preferences) {
      setVoiceStyle(bootstrap.data.preferences.voiceStyle);
      const theme = bootstrap.data.preferences.theme as ThemeName;
      setSelectedTheme(theme);
      document.documentElement.dataset.mayaTheme = theme;
    }
  }, [bootstrap.data]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" }); }, [messages, isStreaming]);
  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 124)}px`;
  }, [messageText]);
  useEffect(() => {
    const hydrateVoices = () => setSpeechVoices(window.speechSynthesis?.getVoices?.() || []);
    hydrateVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", hydrateVoices);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", hydrateVoices);
  }, []);
  useEffect(() => () => {
    if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    recognitionRef.current?.stop?.();
    safelyCancelSpeech(window.speechSynthesis);
  }, []);

  const speak = (text: string, styleIndex = voiceStyle) => {
    const synthesis = window.speechSynthesis;
    if (!canSpeakWith(synthesis) || !("SpeechSynthesisUtterance" in window)) { toast.error("Speech playback is not available in this browser."); return; }
    const style = selectedVoiceSettings(styleIndex, speechVoices.length);
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    utterance.rate = style.rate;
    utterance.pitch = style.pitch;
    const preferredVoice = speechVoices[style.voiceIndex];
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setCallStatus("speaking");
    utterance.onend = () => setCallStatus("ready");
    synthesis.speak(utterance);
  };

  const getPreviewToken = () => {
    try {
      const raw = sessionStorage.getItem("manus-cookie");
      const pair = raw?.split(";").find((value) => value.trim().startsWith(`${COOKIE_NAME}=`));
      return pair?.trim().slice(`${COOKIE_NAME}=`.length) || null;
    } catch { return null; }
  };

  const streamMayaMessage = (message: LocalMessage, speakAfter = false) => {
    setIsStreaming(true);
    const fullText = message.content;
    setMessages((current) => [...current, { ...message, content: "" }]);
    let position = 0;
    const tick = () => {
      position = Math.min(fullText.length, position + Math.max(2, Math.ceil(fullText.length / 58)));
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, content: fullText.slice(0, position) } : item));
      if (position < fullText.length) streamTimerRef.current = setTimeout(tick, 22);
      else { setIsStreaming(false); if (speakAfter) speak(fullText); }
    };
    tick();
  };

  const addReplyPair = (result: { userMessage: LocalMessage; mayaMessage: LocalMessage }, speakAfter = false) => {
    setMessages((current) => [...current, result.userMessage]);
    streamMayaMessage(result.mayaMessage, speakAfter);
    utils.maya.bootstrap.invalidate();
  };

  const submitMessage = async (content = messageText, speakAfter = false) => {
    const trimmed = content.trim();
    if (!trimmed || isStreaming) return;
    const optimisticId = -Date.now();
    const optimisticMessage: LocalMessage = { id: optimisticId, role: "user", kind: "text", content: trimmed, createdAt: new Date(), status: "pending" };
    setMessageText("");
    setFailedText(null);
    setMessages((current) => [...current, optimisticMessage]);
    setIsStreaming(true);
    if (showCall) setCallStatus("thinking");
    let assistantStarted = false;
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const previewToken = getPreviewToken();
      if (previewToken) headers.Authorization = `Bearer ${previewToken}`;
      const response = await fetch("/api/maya/stream", { method: "POST", credentials: "include", headers, body: JSON.stringify({ content: trimmed }) });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({ error: "Maya needs a moment." }))).error);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedReply: LocalMessage | null = null;
      const consumeFrame = (frame: string) => {
        const event = frame.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!event || !data) return;
        let payload: any;
        try { payload = JSON.parse(data); } catch { throw new Error("Maya sent an incomplete reply. Please try again."); }
        if (event === "user") setMessages((current) => current.map((item) => item.id === optimisticId ? payload as LocalMessage : item));
        if (event === "delta") {
          if (!assistantStarted) {
            assistantStarted = true;
            setMessages((current) => [...current, { id: optimisticId - 1, role: "maya", kind: "text", content: payload.delta, createdAt: new Date() }]);
          } else setMessages((current) => current.map((message) => message.id === optimisticId - 1 ? { ...message, content: `${message.content}${payload.delta}` } : message));
        }
        if (event === "done") completedReply = payload.mayaMessage as LocalMessage;
        if (event === "error") throw new Error(payload.message || "Maya could not reply just now.");
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        frames.forEach(consumeFrame);
      }
      if (buffer.trim()) consumeFrame(buffer);
      const finalReply = completedReply as LocalMessage | null;
      if (finalReply) {
        setMessages((current) => assistantStarted ? current.map((message) => message.id === optimisticId - 1 ? finalReply : message) : [...current, finalReply]);
        if (speakAfter) speak(finalReply.content);
      } else if (!assistantStarted) throw new Error("Maya's reply did not complete. Please try again.");
      if (showCall) setCallTranscript("");
      utils.maya.bootstrap.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Maya needs a moment. Please try again.";
      setMessages((current) => current.map((item) => item.id === optimisticId ? { ...item, status: "failed" } : item));
      setFailedText(trimmed);
      toast.error(message);
      setCallStatus("ready");
    } finally { setIsStreaming(false); }
  };

  const reactToMessage = (messageId: number, emoji: string) => {
    reactionMutation.mutate({ messageId, emoji }, {
      onSuccess: (reactions) => { setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions } : message)); setReactionTarget(null); },
      onError: (error) => toast.error(error.message || "Reaction could not be saved."),
    });
  };

  const sendMedia = (input: { type: "GIF"; mediaUrl: string } | { type: "sticker"; sticker: string }) => {
    mediaMutation.mutate(input, {
      onSuccess: (message) => { setMessages((current) => [...current, message as LocalMessage]); setShowMediaPicker(false); utils.maya.bootstrap.invalidate(); },
      onError: (error) => toast.error(error.message || "That media message could not be sent."),
    });
  };

  const startDailyCheckIn = () => {
    const checkInDate = new Date().toISOString().slice(0, 10);
    dailyCheckInMutation.mutate({ checkInDate }, {
      onSuccess: ({ created }) => {
        if (!created) { toast.info("You’ve already opened today’s gentle check-in."); return; }
        setActivePanel("mood");
        void submitMessage("Maya, it’s my daily check-in. Please ask me one warm, thoughtful question about how I’m feeling today, then listen without rushing me.");
        utils.maya.bootstrap.invalidate();
      },
      onError: (error) => toast.error(error.message || "Today’s check-in could not be opened."),
    });
  };

  const updateVoiceStyle = (nextStyle: number) => {
    const selected = selectedVoiceSettings(nextStyle, speechVoices.length);
    setVoiceStyle(selected.styleIndex);
    preferencesMutation.mutate({ voiceStyle: selected.styleIndex }, { onError: () => toast.error("Voice preference could not be saved.") });
    speak(selected.preview, selected.styleIndex);
  };

  const changeTheme = (theme: ThemeName) => {
    setSelectedTheme(theme);
    applyMayaTheme(document.documentElement, theme);
    preferencesMutation.mutate({ theme }, { onError: () => toast.error("Theme preference could not be saved.") });
  };

  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
  const toggleRecording = async () => {
    if (isRecording) { stopRecording(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = preferredAudioMimeType((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) { toast.error("That recording was empty. Please try again."); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result !== "string") return;
          voiceMutation.mutate({ audioData: reader.result, fileName: "maya-voice-note.webm", language: "en" }, {
            onSuccess: (result) => addReplyPair(result, true),
            onError: (error) => toast.error(error.message || "Maya couldn't process that voice note. Please try again."),
          });
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch { toast.error("Microphone access is needed to send a voice note."); }
  };

  const stopListening = () => stopMayaListening(recognitionRef.current, setIsListening, setCallStatus);
  const startListening = () => {
    const Recognition = resolveMayaRecognition((window as any).SpeechRecognition, (window as any).webkitSpeechRecognition, () => toast.error("Live transcription works in browsers that support Web Speech API. You can still use voice notes."));
    if (!Recognition) return;
    prepareMayaListening(window.speechSynthesis);
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onstart = () => { setIsListening(true); setCallStatus("listening"); };
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((part: any) => part[0].transcript).join("");
      setCallTranscript(transcript);
      if (event.results[event.results.length - 1]?.isFinal && transcript.trim()) { setIsListening(false); void submitMessage(transcript, true); }
    };
    recognition.onerror = () => { setIsListening(false); setCallStatus("ready"); toast.error("I couldn't hear that clearly. Try once more?"); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const drawerContent = activePanel !== "chat" ? <MayaContextDrawer panel={activePanel} messages={bootstrap.data?.messages || []} moodEntries={bootstrap.data?.mood?.slice(0, 14) || []} sessions={bootstrap.data?.dailyCheckIns || []} onDailyCheckIn={startDailyCheckIn} /> : null;

  if (isAuthenticated && loading) return <div className="maya-loading"><Loader2 className="animate-spin"/><span>Opening Maya…</span></div>;
  if (!isAuthenticated) return <main className="maya-landing"><section className="maya-landing-card"><div className="maya-brand"><span className="maya-spark"><Sparkles size={17}/></span> maya</div><div className="maya-hero-content"><Avatar mood="joyful" size="lg"/><div><span className="maya-eyebrow">YOUR COMPANION, AT YOUR PACE</span><h1>A little more <em>seen.</em><br/>A little less alone.</h1><p>Maya is a warm AI companion for real conversations, voice notes, games, and small things worth remembering.</p><button className="maya-primary-button" onClick={() => startLogin()}>Meet Maya <ArrowUp size={17}/></button><p className="maya-privacy-note"><Info size={14}/> Private to your account. Maya is an AI companion, not emergency or professional support.</p></div></div></section></main>;

  return <main className="maya-messenger">
    <aside className="maya-chat-list" aria-label="Conversations">
      <header><div className="maya-brand"><span className="maya-spark"><Sparkles size={16}/></span> maya</div><button className="maya-list-settings" onClick={() => setShowSettings(true)} aria-label="Open settings"><Settings2 size={18}/></button></header>
      <div className="maya-list-title"><h2>Chats</h2><span>1</span></div>
      <button className="maya-conversation active" onClick={() => setActivePanel("chat")}><Avatar src={mayaPhoto} mood={activeMood} size="md"/><span className="maya-conversation-copy"><strong>Maya</strong><small>{isStreaming ? "Maya is typing…" : chatPreview}</small></span><time>{messages.length ? shortTime(messages[messages.length - 1].createdAt) : ""}</time></button>
      <div className="maya-list-utilities"><button onClick={() => setActivePanel("memories")}><Heart size={17}/> Memories</button><button onClick={() => setActivePanel("mood")}><Waves size={17}/> Mood journal</button><button onClick={startDailyCheckIn}><Lightbulb size={17}/> Daily check-in</button></div>
      <p className="maya-list-footnote">Your companion chat is private to your signed-in account.</p>
    </aside>

    <section className="maya-chat-pane">
      <header className="maya-chat-header"><div className="flex items-center gap-3"><Avatar src={mayaPhoto} mood={activeMood} size="sm"/><div><h1>Maya</h1><p><span className="maya-live-dot"/> {isStreaming ? "typing…" : activeMood === "caring" ? "listening closely" : "online"}</p></div></div><div className="maya-header-actions"><button className="maya-icon-button" onClick={() => setShowActivities(true)} aria-label="Play or watch with Maya"><CircleDot size={19}/></button><button className="maya-icon-button" onClick={() => { setShowCall(true); speak(`Hey ${userFirstName}, I’m here. What’s on your mind?`); }} aria-label="Call Maya"><Phone size={19}/></button><button className="maya-icon-button maya-mobile-only" onClick={() => setShowSettings(true)} aria-label="More options"><MoreHorizontal size={20}/></button></div></header>

      <div className="maya-message-area">
        {messages.length === 0 && <div className="maya-empty-conversation"><Avatar src={mayaPhoto} mood="joyful" size="lg"/><h2>Hey {userFirstName}.<br/>How are you, really?</h2><p>A private space for ordinary days, big feelings, and everything in between.</p><div className="maya-suggestion-grid">{["I just need someone to talk to", "Tell me something that’ll make me smile", "Can we plan my evening?", "Let’s play something"].map((prompt) => <button key={prompt} onClick={() => void submitMessage(prompt)}>{prompt}<ChevronRight size={15}/></button>)}</div></div>}
        {messages.map((message, index) => <Fragment key={message.id}>{(index === 0 || dayKey(message.createdAt) !== dayKey(messages[index - 1]?.createdAt)) && <div className="maya-date-divider"><span>{dayLabel(message.createdAt)}</span></div>}<article className={`maya-message ${message.role === "user" ? "from-user" : "from-maya"} ${message.status === "failed" ? "failed" : ""} ${shouldVisuallyGroupMessages(messages[index - 1], message) ? "grouped" : ""}`}><div className="maya-message-stack"><div className="maya-bubble">
          {message.kind === "activity" && message.content === "GIF" && message.mediaUrl && <img className="maya-gif" src={message.mediaUrl} alt="GIF shared in the conversation"/>}
          {message.kind === "activity" && message.content.startsWith("Sticker:") && <div className="maya-sticker">{message.content.replace("Sticker: ", "")}</div>}
          {message.kind === "voice" && message.role === "user" && <div className="maya-voice-label"><Waves size={14}/> Voice note · transcribed by Maya</div>}
          {message.kind !== "activity" && <p>{message.content || (message.role === "maya" && isStreaming ? <span className="maya-typing">Maya is typing</span> : "")}</p>}
        </div><div className="maya-message-meta"><span>{shortTime(message.createdAt)}</span>{message.role === "user" && <span className={message.status === "failed" ? "maya-message-failed" : "maya-delivery"} aria-label={deliveryStatusLabel(message.status)} title={deliveryStatusLabel(message.status)}>{message.status === "pending" ? <Clock3 size={12}/> : message.status === "failed" ? "Not sent" : <CheckCheck size={14}/>}</span>}</div><div className="maya-reactions"><div className="maya-reaction-chips">{message.reactions?.map((reaction, reactionIndex) => <span key={`${reaction}-${reactionIndex}`}>{reaction}</span>)}</div><button className="maya-add-reaction" onClick={() => setReactionTarget(reactionTarget === message.id ? null : message.id)} aria-label="Add reaction" aria-expanded={reactionTarget === message.id}>+</button>{reactionTarget === message.id && <div className="maya-reaction-picker" role="group" aria-label="Choose a reaction">{EMOJI_REACTIONS.map((emoji) => <button key={emoji} onClick={() => reactToMessage(message.id, emoji)} aria-label={`React ${emoji}`}>{emoji}</button>)}</div>}</div></div></article></Fragment>)}
        {voiceMutation.isPending && <div className="maya-pending"><Avatar src={mayaPhoto} mood="curious" size="sm"/><span><i/><i/><i/></span></div>}
        {failedText && <div className="maya-retry-row"><span>Message not delivered.</span><button onClick={() => void submitMessage(failedText)}>Try again <RotateCcw size={13}/></button></div>}
        <div ref={bottomRef}/>
      </div>

      <footer className="maya-composer"><div className="maya-composer-tools"><button onClick={() => setShowMediaPicker(true)} aria-label="Send a GIF or sticker"><Sparkles size={19}/></button><button className={isRecording ? "recording" : ""} onClick={toggleRecording} aria-label={isRecording ? "Stop recording" : "Record a voice note"}>{isRecording ? <MicOff size={19}/> : <Mic size={19}/>}</button></div><textarea ref={composerRef} value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }} placeholder="Message Maya" rows={1} aria-label="Message Maya"/><button className="maya-send-button" onClick={() => void submitMessage()} disabled={!messageText.trim() || isStreaming} aria-label="Send message">{isStreaming ? <Loader2 className="animate-spin" size={19}/> : <Send size={19}/>}</button><p>{isRecording ? "Recording… tap the microphone to finish" : isStreaming ? "Maya is replying…" : "Enter to send · Shift + Enter for a new line"}</p></footer>
    </section>

    {activePanel !== "chat" && <aside className="maya-context-drawer"><button className="maya-drawer-close" onClick={() => setActivePanel("chat")} aria-label="Close panel"><X size={19}/></button>{drawerContent}</aside>}

    {showSettings && <div className="maya-modal-backdrop" onMouseDown={() => setShowSettings(false)}><section className="maya-modal maya-settings-modal" role="dialog" aria-modal="true" aria-label="Chat settings" onMouseDown={(event) => event.stopPropagation()}><button className="maya-close" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18}/></button><div className="maya-drawer-heading"><Settings2 size={18}/><div><h2>Chat settings</h2><p>Personalize Maya’s space without losing sight of the conversation.</p></div></div><div className="maya-settings-section"><span>Theme</span><div className="maya-theme-swatches">{(["violet", "rose", "ocean", "sunset"] as ThemeName[]).map((theme) => <button key={theme} className={`theme-${theme} ${selectedTheme === theme ? "selected" : ""}`} onClick={() => changeTheme(theme)} aria-label={`${theme} theme`} aria-pressed={selectedTheme === theme}/>)}</div></div><div className="maya-settings-section"><span>Maya’s voice</span><button className="maya-setting-row" onClick={() => setShowVoicePicker(true)} aria-haspopup="dialog"><Volume2 size={17}/><span>{MAYA_VOICE_STYLES[voiceStyle].name}</span><ChevronRight size={16}/></button></div><div className="maya-settings-section"><span>Private by design</span><p>Chat history, memories, journal entries, preferences, and activity sessions are scoped to your signed-in account.</p></div></section></div>}

    {showVoicePicker && <div className="maya-modal-backdrop" onMouseDown={() => setShowVoicePicker(false)}><section className="maya-modal maya-voice-modal" onMouseDown={(event) => event.stopPropagation()}><button className="maya-close" onClick={() => setShowVoicePicker(false)}><X size={18}/></button><span className="maya-eyebrow">MAYA’S VOICE</span><h2>How should she sound?</h2><p>Choose one of ten expressive styles. Your browser selects the closest available local voice.</p><div className="maya-voice-grid">{MAYA_VOICE_STYLES.map((voice, index) => <button key={voice.name} className={voiceStyle === index ? "selected" : ""} onClick={() => updateVoiceStyle(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{voice.name}</strong><small>{voice.tagline}</small><Play size={14}/></button>)}</div></section></div>}

    {showMediaPicker && <div className="maya-modal-backdrop" onMouseDown={() => setShowMediaPicker(false)}><section className="maya-modal maya-media-modal" onMouseDown={(event) => event.stopPropagation()}><button className="maya-close" onClick={() => setShowMediaPicker(false)}><X size={18}/></button><span className="maya-eyebrow">LITTLE EXTRAS</span><h2>Send a tiny moment.</h2><div className="maya-gif-grid">{GIF_CHOICES.map((gif) => <button key={gif.label} onClick={() => sendMedia({ type: "GIF", mediaUrl: gif.url })}><img src={gif.url} alt={gif.label}/><span>{gif.label}</span></button>)}</div><div className="maya-sticker-grid">{STICKER_CHOICES.map((sticker) => <button key={sticker} onClick={() => sendMedia({ type: "sticker", sticker })}>{sticker}</button>)}</div></section></div>}

    {showActivities && <MayaActivities onClose={() => setShowActivities(false)} onDiscuss={(message) => { setShowActivities(false); void submitMessage(message); }}/>} 
    {showCall && <div className="maya-modal-backdrop maya-call-backdrop"><section className="maya-call-modal"><button className="maya-close" onClick={() => closeMayaCall(recognitionRef.current, window.speechSynthesis, setIsListening, setCallStatus, setShowCall)}><X size={19}/></button><Avatar src={mayaPhoto} mood={callStatus === "thinking" ? "thoughtful" : callStatus === "speaking" ? "joyful" : "caring"} size="lg"/><span className="maya-eyebrow">MAYA CALL</span><h2>{callStatus === "listening" ? "I’m listening…" : callStatus === "thinking" ? "Let me think…" : callStatus === "speaking" ? "Maya is speaking" : "Talk to Maya"}</h2><p>{callTranscript || "Tap the microphone to talk. Maya will reply out loud."}</p><div className="maya-wave-bars">{Array.from({ length: 22 }).map((_, index) => <i key={index} style={{ height: `${18 + ((index * 19) % 36)}px` }}/>)}</div><button className={`maya-call-mic ${isListening ? "live" : ""}`} onClick={isListening ? stopListening : startListening}>{isListening ? <MicOff size={22}/> : <Mic size={22}/>}</button><small>Live transcription uses your browser’s Web Speech API</small></section></div>}
  </main>;
}
