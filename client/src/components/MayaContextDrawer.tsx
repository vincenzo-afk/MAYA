import { Heart, Lightbulb, Waves } from "lucide-react";
import React from "react";

type DrawerMessage = { id: number; role: string; emotion?: string | null };
type DrawerMood = { id: number; checkInId?: number | null; mayaEmotion?: string | null; userMood?: string | null; createdAt?: Date | string };
type DrawerSession = { id: number; checkInDate: string };

function shortTime(value?: Date | string) {
  if (!value) return "now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "now" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MayaContextDrawer({ panel, messages, moodEntries, sessions, onDailyCheckIn }: {
  panel: "memories" | "mood";
  messages: DrawerMessage[];
  moodEntries: DrawerMood[];
  sessions: DrawerSession[];
  onDailyCheckIn: () => void;
}) {
  if (panel === "memories") {
    const sharedMoments = messages.filter((message) => message.role === "maya").slice(-4);
    return <><div className="maya-drawer-heading"><Heart size={18}/><div><h2>What Maya remembers</h2><p>Details stay private to your account and help your conversations feel continuous.</p></div></div><div className="maya-drawer-list">{sharedMoments.length ? sharedMoments.map((message) => <div className="maya-memory-card" key={message.id}><Heart size={14}/><span>{message.emotion ? `A ${message.emotion} moment you shared` : "A shared moment with Maya"}</span></div>) : <div className="maya-empty-card">Tell Maya the little things that matter to you.</div>}</div></>;
  }

  return <><div className="maya-drawer-heading"><Waves size={18}/><div><h2>Your mood journal</h2><p>A private check-in rhythm — not a diagnosis.</p></div></div><button className="maya-journal-checkin" onClick={onDailyCheckIn}><Lightbulb size={15}/> Open today’s check-in</button><div className="maya-mood-list">{sessions.length ? sessions.map((session) => { const sessionEntries = moodEntries.filter((entry) => entry.checkInId === session.id); return <div key={session.id} className="maya-mood-session"><small>{new Date(`${session.checkInDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · check-in</small>{sessionEntries.length ? sessionEntries.map((entry) => <div key={entry.id} className="maya-mood-row"><span className={`maya-mood-dot maya-mood-${entry.mayaEmotion || "calm"}`} /><span>{entry.userMood}</span><small>{shortTime(entry.createdAt)}</small></div>) : <p>Your thoughts from this check-in will appear here.</p>}</div>; }) : <div className="maya-empty-card">Open a check-in to begin your private journal.</div>}</div></>;
}
