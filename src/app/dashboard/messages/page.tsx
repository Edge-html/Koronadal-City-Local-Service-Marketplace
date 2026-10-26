"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, Notice } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { sendDirectMessage, subscribeToConversations, subscribeToMessages } from "@/lib/data";
import type { Conversation, DirectMessage } from "@/lib/types";

function MessagesContent() {
  const { user } = useAuth();
  const params = useSearchParams();
  const requested = params.get("conversation") ?? "";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState(requested);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useMemo(() => conversations.find((thread) => thread.id === selected) ?? null, [conversations, selected]);

  useEffect(() => { setSelected(requested); }, [requested]);
  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(user.uid, (rows) => {
      setConversations(rows);
      setSelected((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id ?? "");
    }, () => setError("Could not load your conversations. Check the deployed Firestore rules."));
  }, [user]);
  useEffect(() => {
    setMessages([]);
    if (!selected) return;
    return subscribeToMessages(selected, setMessages, () => setError("You do not have access to this conversation or its messages."));
  }, [selected]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !active || !draft.trim()) return;
    setBusy(true); setError("");
    try {
      await sendDirectMessage(active.id, { id: user.uid, name: user.displayName || user.email || "KoroHanap user" }, draft);
      setDraft("");
    } catch (err) { setError(err instanceof Error ? err.message : "Message could not be sent."); }
    finally { setBusy(false); }
  }

  return <DashboardShell eyebrow="Private chat" title="Messages" subtitle="Coordinate directly with a worker or household. Keep personal or payment details private until you are comfortable sharing them.">
    {error ? <Notice tone="alert">{error}</Notice> : null}
    <div className="mt-4 grid min-h-[560px] gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="overflow-hidden p-0">
        <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-medium">Conversations</h2>
        {conversations.length === 0 ? <p className="p-4 text-sm text-stone-500">No messages yet. Open a worker profile and choose “Message this worker”.</p> : <ul className="divide-y divide-stone-100">{conversations.map((thread) => {
          const other = thread.consumerId === user?.uid ? thread.workerName : thread.consumerName;
          return <li key={thread.id}><button type="button" onClick={() => setSelected(thread.id)} className={`w-full p-4 text-left ${selected === thread.id ? "bg-emerald-50" : "hover:bg-stone-50"}`}><span className="block text-sm font-medium">{other}</span><span className="mt-1 block truncate text-xs text-stone-500">{thread.lastMessage || "Start the conversation"}</span></button></li>;
        })}</ul>}
      </Card>
      <Card className="flex min-h-[560px] flex-col p-0">
        {active ? <>
          <header className="border-b border-stone-200 px-5 py-4"><h2 className="text-sm font-medium">{active.consumerId === user?.uid ? active.workerName : active.consumerName}</h2><p className="caption mt-1">{active.consumerId === user?.uid ? "Worker" : "Household"}</p></header>
          <div className="flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">{messages.length === 0 ? <p className="text-sm text-stone-500">Send a message to start.</p> : messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.senderId === user?.uid ? "ml-auto bg-emerald-100 text-stone-900" : "bg-stone-100 text-stone-800"}`}><p className="mb-1 text-[11px] font-medium text-stone-500">{message.senderId === user?.uid ? "You" : message.senderName}</p><p className="whitespace-pre-wrap break-words">{message.body}</p></div>)}</div>
          <form onSubmit={send} className="flex gap-2 border-t border-stone-200 p-4"><textarea aria-label="Write a message" className="field min-h-11 flex-1 resize-y" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} placeholder="Write a message…" maxLength={2000} /><button type="submit" className="btn-primary self-end" disabled={busy || !draft.trim()}><Send size={14} />{busy ? "Sending…" : "Send"}</button></form>
        </> : <div className="grid flex-1 place-items-center p-6 text-center text-sm text-stone-500">Select a conversation, or browse workers to start a chat.<Link href="/browse" className="mt-2 text-stone-800 underline">Find a worker</Link></div>}
      </Card>
    </div>
  </DashboardShell>;
}

export default function MessagesPage() { return <Suspense fallback={null}><MessagesContent /></Suspense>; }
