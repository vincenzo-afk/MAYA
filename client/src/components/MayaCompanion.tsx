import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { COOKIE_NAME } from "@shared/const";
import MayaActivities from "@/components/MayaActivities";
import {
  ArrowUp,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Heart,
  Image as ImageIcon,
  Info,
  Lightbulb,
  Loader2,
  Maximize2,
  MessageCircleHeart,
  Mic,
  MicOff,
  MoreHorizontal,
  Palette,
  Phone,
  Play,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const DEFAULT_MAYA_PHOTO = "/manus-storage/maya-avatar_bec413f2.jpg";

const VOICE_STYLES = [
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
};

function shortTime(value?: Date | string) {
  if (!value) return "now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "now" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function cleanForSpeech(text: string) {
  return text.replace(/[*_`#]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

function Avatar({ src, mood = "calm", size = "md" }: { src: string; mood?: string | null; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-36 w-36" : "h-11 w-11";
  return (
    <div className={`relative shrink-0 ${dimensions}`}>
      <img src={src} alt="Maya" className="h-full w-full rounded-[1.1rem] object-cover shadow-[0_8px_22px_rgba(36,20,56,.25)]" />
      <span className={`maya-mood-dot maya-mood-${mood?.toLowerCase() || "calm"}`} />
    </div>
  );
}

export default function MayaCompanion() {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const bootstrap = trpc.maya.bootstrap.useQuery(undefined, { enabled: isAuthenticated });
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"chat" | "memories" | "mood">("chat");
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [callTranscript, setCallTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [callStatus, setCallStatus] = useState<"ready" | "listening" | "thinking" | "speaking">("ready");
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mayaPhoto = bootstrap.data?.preferences?.displayPhoto || DEFAULT_MAYA_PHOTO;
  const latestMaya = [...messages].reverse().find((message) => message.role === "maya");
  const activeMood = latestMaya?.emotion || "calm";
  const userFirstName = user?.name?.split(" ")[0] || "there";

  useEffect(() => {
    if (bootstrap.data?.messages) setMessages(bootstrap.data.messages as LocalMessage[]);
    if (bootstrap.data?.preferences) setVoiceStyle(bootstrap.data.preferences.voiceStyle);
  }, [bootstrap.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    const hydrateVoices = () => setSpeechVoices(window.speechSynthesis?.getVoices?.() || []);
    hydrateVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", hydrateVoices);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", hydrateVoices);
  }, []);

  useEffect(() => () => {
    if (streamingTimerRef.current) clearTimeout(streamingTimerRef.current);
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  const photoMutation = trpc.maya.generatePhoto.useMutation();
  const voiceMutation = trpc.maya.processVoiceNote.useMutation();
  const reactionMutation = trpc.maya.setReaction.useMutation();
  const mediaMutation = trpc.maya.sendMedia.useMutation();
  const dailyCheckInMutation = trpc.maya.openDailyCheckIn.useMutation();
  const preferencesMutation = trpc.maya.updatePreferences.useMutation();

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Speech playback is not available in this browser.");
      return;
    }
    const style = VOICE_STYLES[voiceStyle];
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    utterance.rate = style.rate;
    utterance.pitch = style.pitch;
    const preferredVoice = speechVoices[voiceStyle % Math.max(speechVoices.length, 1)];
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setCallStatus("speaking");
    utterance.onend = () => setCallStatus("ready");
    window.speechSynthesis.speak(utterance);
  };

  const streamMayaMessage = (message: LocalMessage, speakAfter = false) => {
    setIsStreaming(true);
    const fullText = message.content;
    setMessages((current) => [...current, { ...message, content: "" }]);
    let position = 0;
    const tick = () => {
      position = Math.min(fullText.length, position + Math.max(2, Math.ceil(fullText.length / 58)));
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, content: fullText.slice(0, position) } : item));
      if (position < fullText.length) {
        streamingTimerRef.current = setTimeout(tick, 22);
      } else {
        setIsStreaming(false);
        if (speakAfter) speak(fullText);
      }
    };
    tick();
  };

  const addReplyPair = (result: { userMessage: LocalMessage; mayaMessage: LocalMessage }, speakAfter = false) => {
    setMessages((current) => [...current, result.userMessage]);
    streamMayaMessage(result.mayaMessage, speakAfter);
    utils.maya.bootstrap.invalidate();
  };

  const getPreviewToken = (): string | null => {
    try {
      const raw = sessionStorage.getItem("manus-cookie");
      const pair = raw?.split(";").find((value) => value.trim().startsWith(`${COOKIE_NAME}=`));
      const token = pair?.trim().slice(`${COOKIE_NAME}=`.length);
      return token || null;
    } catch { return null; }
  };

  const submitMessage = async (content = messageText, speakAfter = false) => {
    const trimmed = content.trim();
    if (!trimmed || isStreaming) return;
    setMessageText("");
    setIsStreaming(true);
    if (showCall) setCallStatus("thinking");
    const optimisticId = -Date.now();
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
        const payload = JSON.parse(data);
        if (event === "user") setMessages((current) => [...current, payload as LocalMessage]);
        if (event === "delta") {
          if (!assistantStarted) { assistantStarted = true; setMessages((current) => [...current, { id: optimisticId, role: "maya", kind: "text", content: payload.delta, createdAt: new Date() }]); }
          else setMessages((current) => current.map((message) => message.id === optimisticId ? { ...message, content: `${message.content}${payload.delta}` } : message));
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
      const finalReply = completedReply as LocalMessage | null;
      if (finalReply !== null) {
        setMessages((current) => assistantStarted ? current.map((message) => message.id === optimisticId ? finalReply : message) : [...current, finalReply]);
        if (speakAfter) speak(finalReply.content);
      }
      if (showCall) setCallTranscript("");
      utils.maya.bootstrap.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Maya needs a moment. Please try again.");
      setCallStatus("ready");
    } finally { setIsStreaming(false); }
  };

  const promptForPhoto = () => {
    const prompt = window.prompt("What kind of photo should Maya send?", "a cozy coffee shop selfie on a rainy evening");
    if (!prompt?.trim()) return;
    photoMutation.mutate({ prompt }, {
      onSuccess: (message) => {
        setMessages((current) => [...current, message as LocalMessage]);
        utils.maya.bootstrap.invalidate();
      },
      onError: (error) => toast.error(error.message || "Maya couldn't make that photo just now."),
    });
  };

  const reactToMessage = (messageId: number, emoji: string) => {
    reactionMutation.mutate({ messageId, emoji }, {
      onSuccess: (reactions) => setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions } : message)),
      onError: (error) => toast.error(error.message || "Reaction could not be saved."),
    });
  };

  const sendMedia = (input: { type: "GIF"; mediaUrl: string } | { type: "sticker"; sticker: string }) => {
    mediaMutation.mutate(input, {
      onSuccess: (message) => {
        setMessages((current) => [...current, message as LocalMessage]);
        setShowMediaPicker(false);
        utils.maya.bootstrap.invalidate();
      },
      onError: (error) => toast.error(error.message || "That media message could not be sent."),
    });
  };

  const startDailyCheckIn = () => {
    const today = new Date().toISOString().slice(0, 10);
    dailyCheckInMutation.mutate({ checkInDate: today }, {
      onSuccess: ({ created }) => {
        if (!created) { toast.info("You’ve already opened today’s gentle check-in."); return; }
        void submitMessage("Maya, it’s my daily check-in. Please ask me one warm, thoughtful question about how I’m feeling today, then listen without rushing me.");
        utils.maya.bootstrap.invalidate();
      },
      onError: (error) => toast.error(error.message || "Today’s check-in could not be opened."),
    });
  };

  const updateVoiceStyle = (nextStyle: number) => {
    setVoiceStyle(nextStyle);
    setShowVoicePicker(false);
    preferencesMutation.mutate({ voiceStyle: nextStyle }, { onError: () => toast.error("Voice preference could not be saved.") });
    speak("Hi, this is how I sound.");
  };

  const usePhotoAsAvatar = (url: string) => {
    preferencesMutation.mutate({ displayPhoto: url }, {
      onSuccess: () => { utils.maya.bootstrap.invalidate(); toast.success("Maya's display photo is updated."); },
      onError: () => toast.error("That display photo could not be saved."),
    });
  };

  const stopRecording = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  const toggleRecording = async () => {
    if (isRecording) { stopRecording(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => event.data.size > 0 && chunksRef.current.push(event.data);
      recorder.onstop = () => {
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const audioData = reader.result;
          if (typeof audioData !== "string") return;
          voiceMutation.mutate({ audioData, fileName: "maya-voice-note.webm", language: "en" }, {
            onSuccess: (result) => addReplyPair(result, true),
            onError: (error) => toast.error(error.message || "Maya couldn't process that voice note. Please try again."),
          });
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access is needed to send a voice note.");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
    setCallStatus("ready");
  };

  const startListening = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Live call transcription works in browsers that support Web Speech API. You can still use voice notes.");
      return;
    }
    window.speechSynthesis.cancel();
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onstart = () => { setIsListening(true); setCallStatus("listening"); };
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((part: any) => part[0].transcript).join("");
      setCallTranscript(transcript);
      const finalResult = event.results[event.results.length - 1];
      if (finalResult?.isFinal && transcript.trim()) {
        setIsListening(false);
        submitMessage(transcript, true);
      }
    };
    recognition.onerror = () => { setIsListening(false); setCallStatus("ready"); toast.error("I couldn't hear that clearly. Try once more?"); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const changeTheme = (theme: "violet" | "rose" | "ocean" | "sunset") => {
    document.documentElement.dataset.mayaTheme = theme;
    preferencesMutation.mutate({ theme }, { onError: () => toast.error("Theme preference could not be saved.") });
  };

  useEffect(() => {
    if (bootstrap.data?.preferences?.theme) document.documentElement.dataset.mayaTheme = bootstrap.data.preferences.theme;
  }, [bootstrap.data?.preferences?.theme]);

  const panelContent = useMemo(() => {
    if (activePanel === "memories") {
      return <aside className="maya-panel"><div className="maya-panel-title"><Sparkles size={16} /> What Maya remembers</div><p className="maya-panel-subtitle">Saved details stay private to your account and help Maya feel more continuous.</p><div className="space-y-2.5">{bootstrap.data?.messages?.filter((message) => message.role === "maya").slice(-3).map((message) => <div className="maya-memory-card" key={message.id}><Heart size={13} /> {message.emotion ? `Maya was ${message.emotion}` : "A shared moment"}</div>) || <div className="maya-empty-card">Tell Maya the little things that matter to you.</div>}</div></aside>;
    }
    if (activePanel === "mood") {
      const entries = bootstrap.data?.mood?.slice(0, 14) || [];
      const sessions = bootstrap.data?.dailyCheckIns || [];
      return <aside className="maya-panel"><div className="maya-panel-title"><Waves size={16} /> Your mood journal</div><p className="maya-panel-subtitle">A private, check-in-by-check-in rhythm — not a diagnosis.</p><button className="maya-journal-checkin" onClick={startDailyCheckIn}>Open today’s check-in <Heart size={13}/></button><div className="maya-mood-list">{sessions.length ? sessions.map((session) => { const sessionEntries = entries.filter((item) => item.checkInId === session.id); return <div key={session.id} className="maya-mood-session"><small>{new Date(`${session.checkInDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · check-in</small>{sessionEntries.length ? sessionEntries.map((item) => <div key={item.id} className="maya-mood-row"><span className={`maya-mood-dot maya-mood-${item.mayaEmotion}`} /><span>{item.userMood}</span><small>{shortTime(item.createdAt)}</small></div>) : <p className="text-xs opacity-70 mt-1">Your thoughts from this check-in will appear here.</p>}</div>; }) : <div className="maya-empty-card">Open a check-in to begin your private journal.</div>}</div></aside>;
    }
    return <aside className="maya-panel"><div className="maya-panel-title"><CircleDot size={16} /> Maya right now</div><div className="maya-now-card"><Avatar src={mayaPhoto} mood={activeMood} size="lg" /><div><span className="maya-presence"><span /> Present with you</span><h2>{activeMood === "caring" ? "Softly attentive" : activeMood === "playful" ? "In a playful mood" : activeMood === "joyful" ? "Feeling bright" : "Calm and curious"}</h2><p>Her responses adapt to the moment — your tone, your memories, and what you share.</p></div></div><button className="maya-checkin" onClick={startDailyCheckIn}><Lightbulb size={16}/><span>Open today’s gentle check-in</span></button></aside>;
  }, [activeMood, activePanel, bootstrap.data?.dailyCheckIns, bootstrap.data?.messages, bootstrap.data?.mood, mayaPhoto]);

  if (isAuthenticated && loading) return <div className="maya-loading"><Loader2 className="animate-spin" /> <span>Waking up Maya…</span></div>;

  if (!isAuthenticated) {
    return <main className="maya-landing"><div className="maya-landing-orb maya-landing-orb-one" /><div className="maya-landing-orb maya-landing-orb-two" /><section className="maya-landing-card"><div className="maya-brand"><span className="maya-spark"><Sparkles size={17}/></span> maya</div><div className="maya-hero-content"><Avatar src={DEFAULT_MAYA_PHOTO} mood="joyful" size="lg" /><div><span className="maya-eyebrow">YOUR COMPANION, AT YOUR PACE</span><h1>A little more <em>seen.</em><br/>A little less alone.</h1><p>Maya is a warm, witty AI companion for real conversations, voice notes, games, and all the small things you want someone to remember.</p><button className="maya-primary-button" onClick={() => startLogin()}>Meet Maya <ArrowUp size={17}/></button><p className="maya-privacy-note"><Info size={14}/> Private to your account. Maya is an AI companion, not a replacement for professional or emergency support.</p></div></div><div className="maya-landing-footer"><span>Warm conversations</span><span>Voice notes & calls</span><span>Shared little worlds</span></div></section></main>;
  }

  return <main className="maya-app-shell">
    <aside className="maya-sidebar">
      <div className="maya-brand"><span className="maya-spark"><Sparkles size={16}/></span> maya</div>
      <nav className="maya-nav" aria-label="Maya sections">
        <button className={activePanel === "chat" ? "active" : ""} onClick={() => setActivePanel("chat")}><MessageCircleHeart size={18}/> <span>Just us</span></button>
        <button className={activePanel === "memories" ? "active" : ""} onClick={() => setActivePanel("memories")}><Heart size={18}/> <span>Memories</span></button>
        <button className={activePanel === "mood" ? "active" : ""} onClick={() => setActivePanel("mood")}><Waves size={18}/> <span>Mood space</span></button>
      </nav>
      <div className="maya-sidebar-bottom"><button onClick={() => setShowVoicePicker(true)}><Volume2 size={18}/> Voice: {VOICE_STYLES[voiceStyle].name}</button><button onClick={() => changeTheme(bootstrap.data?.preferences?.theme === "violet" ? "rose" : "violet")}><Palette size={18}/> Change mood</button><button onClick={() => toast.info("Maya keeps conversation data in your signed-in account.")}><Settings2 size={18}/> Settings</button></div>
    </aside>

    <section className="maya-main-column">
      <header className="maya-chat-header"><div className="flex items-center gap-3"><Avatar src={mayaPhoto} mood={activeMood} size="sm"/><div><h1>Maya <span>·</span> <small>here with you</small></h1><p><span className="maya-live-dot"/> {activeMood === "caring" ? "listening closely" : "online and curious"}</p></div></div><div className="maya-header-actions"><button className="maya-icon-button" onClick={() => setShowActivities(true)} aria-label="Play or watch with Maya"><Bot size={18}/></button><button className="maya-icon-button" onClick={promptForPhoto} aria-label="Ask Maya for a photo"><ImageIcon size={18}/></button><button className="maya-call-button" onClick={() => { setShowCall(true); speak("Hey " + userFirstName + ", I’m here. What’s on your mind?"); }}><Phone size={17}/><span>Call Maya</span></button><button className="maya-mobile-panel" onClick={() => setActivePanel(activePanel === "chat" ? "memories" : "chat")}><MoreHorizontal size={19}/></button></div></header>

      <div className="maya-message-area">
        {messages.length === 0 && <div className="maya-empty-conversation"><Avatar src={mayaPhoto} mood="joyful" size="lg"/><span className="maya-eyebrow">A QUIET PLACE, JUST FOR YOU</span><h2>Hey {userFirstName}.<br/>What’s sitting with you today?</h2><div className="maya-suggestion-grid">{["I just need someone to talk to", "Tell me something that’ll make me smile", "Can we plan my evening?", "Let’s play something"].map((prompt) => <button key={prompt} onClick={() => submitMessage(prompt)}>{prompt}<ChevronRight size={15}/></button>)}</div></div>}
        {messages.map((message) => <article key={message.id} className={`maya-message ${message.role === "user" ? "from-user" : "from-maya"}`}>
          {message.role === "maya" && <Avatar src={mayaPhoto} mood={message.emotion} size="sm"/>}
          <div className="maya-message-stack"><div className={`maya-bubble ${message.kind === "photo" ? "maya-photo-bubble" : ""}`}>
            {message.kind === "photo" && message.mediaUrl && <button className="maya-photo-wrap" onClick={() => setSelectedPhoto(message.mediaUrl || null)}><img src={message.mediaUrl} alt="A photo Maya sent"/><span><Maximize2 size={15}/> Tap to open</span></button>}
            {message.kind === "activity" && message.content === "GIF" && message.mediaUrl && <img className="max-h-52 rounded-xl" src={message.mediaUrl} alt="GIF shared in the conversation"/>}
            {message.kind === "activity" && message.content.startsWith("Sticker:") && <div className="py-2 text-5xl leading-none">{message.content.replace("Sticker: ", "")}</div>}
            {message.kind === "voice" && message.role === "user" && <div className="maya-voice-label"><Waves size={14}/> Voice note · transcribed by Maya</div>}
            {message.kind !== "activity" && <p>{message.content || (message.role === "maya" && isStreaming ? <span className="maya-typing">Maya is writing</span> : "")}</p>}
          </div><div className="maya-message-meta"><span>{shortTime(message.createdAt)}</span>{message.role === "maya" && message.kind === "photo" && message.mediaUrl && <button onClick={() => usePhotoAsAvatar(message.mediaUrl!)}>Use as Maya’s photo</button>}</div><div className="maya-reactions"><div className="maya-reaction-chips">{message.reactions?.map((reaction, index) => <span key={`${reaction}-${index}`}>{reaction}</span>)}</div><div className="maya-reaction-picker">{EMOJI_REACTIONS.map((emoji) => <button key={emoji} onClick={() => reactToMessage(message.id, emoji)} aria-label={`React ${emoji}`}>{emoji}</button>)}</div></div></div>
        </article>)}
        {(voiceMutation.isPending || photoMutation.isPending) && <div className="maya-pending"><Avatar src={mayaPhoto} mood="curious" size="sm"/><span><i/><i/><i/></span></div>}
        <div ref={bottomRef} />
      </div>

      <footer className="maya-composer"><div className="maya-composer-tools"><button onClick={() => setShowMediaPicker(true)} aria-label="Send a GIF or sticker"><Sparkles size={18}/></button><button onClick={promptForPhoto} aria-label="Request a Maya photo"><ImageIcon size={18}/></button><button className={isRecording ? "recording" : ""} onClick={toggleRecording} aria-label={isRecording ? "Stop recording" : "Record a voice note"}>{isRecording ? <MicOff size={18}/> : <Mic size={18}/>}</button><button onClick={startDailyCheckIn} aria-label="Daily check-in"><Heart size={18}/></button></div><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }} placeholder="Message Maya…" rows={1}/><button className="maya-send-button" onClick={() => void submitMessage()} disabled={!messageText.trim() || isStreaming}>{isStreaming ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}</button><p>{isRecording ? "Recording… tap the mic when you’re done" : "Maya listens with care. Press Enter to send."}</p></footer>
    </section>

    <section className="maya-insight-column">{panelContent}<div className="maya-theme-card"><div><Palette size={16}/><span>Make it yours</span></div><p>Pick a little atmosphere for this space.</p><div className="maya-theme-swatches">{(["violet", "rose", "ocean", "sunset"] as const).map((theme) => <button key={theme} className={`theme-${theme} ${bootstrap.data?.preferences?.theme === theme ? "selected" : ""}`} onClick={() => changeTheme(theme)} aria-label={`${theme} theme`}/>)}</div></div></section>

    {showVoicePicker && <div className="maya-modal-backdrop" onMouseDown={() => setShowVoicePicker(false)}><div className="maya-modal maya-voice-modal" onMouseDown={(event) => event.stopPropagation()}><button className="maya-close" onClick={() => setShowVoicePicker(false)}><X size={18}/></button><span className="maya-eyebrow">MAYA’S VOICE</span><h2>How should she sound?</h2><p>Choose one of ten expressive styles. Your browser selects the closest available local voice.</p><div className="maya-voice-grid">{VOICE_STYLES.map((voice, index) => <button key={voice.name} className={voiceStyle === index ? "selected" : ""} onClick={() => updateVoiceStyle(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{voice.name}</strong><small>{voice.tagline}</small><Play size={14}/></button>)}</div></div></div>}

    {showMediaPicker && <div className="maya-modal-backdrop" onMouseDown={() => setShowMediaPicker(false)}><div className="maya-modal" onMouseDown={(event) => event.stopPropagation()}><button className="maya-close" onClick={() => setShowMediaPicker(false)}><X size={18}/></button><span className="maya-eyebrow">LITTLE EXTRAS</span><h2>Send a tiny moment.</h2><p>Choose a GIF or sticker. Every message can still receive reactions.</p><div className="mt-4 grid grid-cols-3 gap-2">{GIF_CHOICES.map((gif) => <button key={gif.label} className="overflow-hidden rounded-xl border border-white/10" onClick={() => sendMedia({ type: "GIF", mediaUrl: gif.url })}><img className="aspect-square w-full object-cover" src={gif.url} alt={gif.label}/><span className="block p-1 text-[10px]">{gif.label}</span></button>)}</div><div className="mt-4 flex flex-wrap gap-2">{STICKER_CHOICES.map((sticker) => <button key={sticker} className="rounded-xl bg-white/5 p-3 text-2xl" onClick={() => sendMedia({ type: "sticker", sticker })}>{sticker}</button>)}</div></div></div>}

    {showActivities && <MayaActivities onClose={() => setShowActivities(false)} onDiscuss={(message) => { setShowActivities(false); void submitMessage(message); }} />}

    {showCall && <div className="maya-modal-backdrop maya-call-backdrop"><div className="maya-call-modal"><button className="maya-close" onClick={() => { stopListening(); window.speechSynthesis.cancel(); setShowCall(false); }}><X size={19}/></button><span className="maya-call-noise"/><Avatar src={mayaPhoto} mood={callStatus === "thinking" ? "thoughtful" : callStatus === "speaking" ? "joyful" : "caring"} size="lg"/><span className="maya-eyebrow">MAYA CALL</span><h2>{callStatus === "listening" ? "I’m listening…" : callStatus === "thinking" ? "Let me think…" : callStatus === "speaking" ? "Maya is speaking" : "Talk to Maya"}</h2><p>{callTranscript || "Tap the microphone to talk. Maya will reply out loud."}</p><div className="maya-wave-bars">{Array.from({ length: 22 }).map((_, index) => <i key={index} style={{ height: `${18 + ((index * 19) % 36)}px` }}/>)}</div><button className={`maya-call-mic ${isListening ? "live" : ""}`} onClick={isListening ? stopListening : startListening}>{isListening ? <MicOff size={22}/> : <Mic size={22}/>}</button><small>Live transcription uses your browser’s Web Speech API</small></div></div>}

    {selectedPhoto && <div className="maya-modal-backdrop" onMouseDown={() => setSelectedPhoto(null)}><div className="maya-image-modal" onMouseDown={(event) => event.stopPropagation()}><button className="maya-close" onClick={() => setSelectedPhoto(null)}><X size={19}/></button><img src={selectedPhoto} alt="Maya's full photo"/><button className="maya-primary-button maya-use-photo" onClick={() => usePhotoAsAvatar(selectedPhoto)}>Use as Maya’s display photo</button></div></div>}
  </main>;
}
