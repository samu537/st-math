import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

type Message = {
  id: string;
  nickname: string;
  body: string;
  color: string;
  created_at: string;
};

const NICK_KEY = "samu_chat_nick";
const COLOR_KEY = "samu_chat_color";
const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

function randomNick() {
  const animals = ["Fox", "Wolf", "Hawk", "Tiger", "Bear", "Otter", "Lynx", "Falcon", "Raven", "Shark"];
  return animals[Math.floor(Math.random() * animals.length)] + Math.floor(Math.random() * 1000);
}

export function ChatRoom() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [editingNick, setEditingNick] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let nick = localStorage.getItem(NICK_KEY);
    let col = localStorage.getItem(COLOR_KEY);
    if (!nick) { nick = randomNick(); localStorage.setItem(NICK_KEY, nick); }
    if (!col) { col = PALETTE[Math.floor(Math.random() * PALETTE.length)]; localStorage.setItem(COLOR_KEY, col); }
    setNickname(nick);
    setColor(col);
  }, []);

  useEffect(() => {
    supabase
      .from("chat_messages")
      .select("id,nickname,body,color,created_at")
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data }) => { if (data) setMessages((data as Message[]).reverse()); });

    const channel = supabase
      .channel("chat-room")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message].slice(-200));
        if (!open) setUnread((u) => u + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open]);

  useEffect(() => {
    if (open) setUnread(0);
    requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, open]);

  const saveNick = () => {
    const clean = nickname.trim().slice(0, 40) || randomNick();
    setNickname(clean);
    localStorage.setItem(NICK_KEY, clean);
    localStorage.setItem(COLOR_KEY, color);
    setEditingNick(false);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ nickname, body: body.slice(0, 500), color });
    if (error) console.error("chat send", error);
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-ember text-2xl text-primary-foreground shadow-[0_0_30px_-4px_var(--color-primary)] transition hover:scale-105"
        aria-label="Open chat"
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-background px-1 text-xs font-black text-primary ring-2 ring-primary">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/15 to-transparent px-4 py-3">
            <div>
              <div className="text-sm font-black tracking-tight">Live Chat</div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                Everyone on the site
              </div>
            </div>
            <button
              onClick={() => setEditingNick((v) => !v)}
              className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <span style={{ color }}>●</span> {nickname}
            </button>
          </div>

          {editingNick && (
            <div className="border-b border-border bg-input/40 p-3">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 40))}
                className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm outline-none focus:border-primary"
                placeholder="Your nickname"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-card ${color === c ? "ring-foreground" : "ring-transparent"}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
              <button onClick={saveNick} className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110">
                Save
              </button>
            </div>
          )}

          <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Be the first to say hi 👋</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="rounded-lg bg-input/40 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold" style={{ color: m.color }}>{m.nickname}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-sm text-foreground">{m.body}</p>
              </div>
            ))}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border bg-card p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="Type a message..."
              className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="submit" className="rounded-md bg-gradient-to-br from-primary to-ember px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
