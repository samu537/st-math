import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/auth-context";
import { VoiceRoom } from "@/components/VoiceRoom";

export const Route = createFileRoute("/groups/$groupId")({
  component: GroupDetail,
  head: () => ({ meta: [{ title: "Group · Samu Game Hub" }] }),
});

type Group = { id: string; name: string; description: string; is_public: boolean; owner_id: string };
type Msg = { id: string; group_id: string; user_id: string; body: string; created_at: string };

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const { data: g } = await supabase.from("groups").select("id,name,description,is_public,owner_id").eq("id", groupId).maybeSingle();
      if (!g) { setNotFound(true); return; }
      setGroup(g as Group);
      if (user) {
        const { data: m } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
        setIsMember(!!m);
      }
      const { data: mems } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
      const ids = (mems ?? []).map((x) => x.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,username,display_name,color").in("id", ids);
        setMembers((profs ?? []) as Profile[]);
      }
    })();
  }, [groupId, user, loading]);

  useEffect(() => {
    if (!isMember) return;
    supabase.from("group_messages").select("id,group_id,user_id,body,created_at")
      .eq("group_id", groupId).order("created_at", { ascending: false }).limit(80)
      .then(({ data }) => { if (data) setMessages((data as Msg[]).reverse()); });

    const ch = supabase.channel("group-msg-" + groupId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg].slice(-200)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isMember, groupId]);

  useEffect(() => {
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight }));
  }, [messages]);

  const join = async () => {
    if (!user) return;
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id });
    if (!error) setIsMember(true);
  };

  const leave = async () => {
    if (!user) return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    navigate({ to: "/groups" });
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    await supabase.from("group_messages").insert({ group_id: groupId, user_id: user.id, body: body.slice(0, 1000) });
  };

  if (notFound) return <Shell><p className="text-muted-foreground">Group not found or private.</p><Link to="/groups" className="mt-2 inline-block text-primary">← back</Link></Shell>;
  if (loading || !group) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  if (!user) return <Shell><div className="rounded-2xl border border-border bg-card p-6 text-center"><p className="mb-3">Sign in to view this group.</p><Link to="/auth" className="rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">Sign in</Link></div></Shell>;
  if (!isMember) {
    return (
      <Shell>
        <h1 className="text-3xl font-black">{group.name}</h1>
        {group.description && <p className="mt-2 text-muted-foreground">{group.description}</p>}
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center">
          {group.is_public ? (
            <>
              <p className="mb-3">Join this group to chat and use voice.</p>
              <button onClick={join} className="rounded-md bg-gradient-to-br from-primary to-ember px-5 py-2.5 font-bold text-primary-foreground hover:brightness-110">Join group</button>
            </>
          ) : (
            <p>This is a private group. Ask a member to invite you.</p>
          )}
        </div>
      </Shell>
    );
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black">{group.name}</h1>
          {group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}
        </div>
        <button onClick={leave} className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive">
          Leave
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          {profile && <VoiceRoom roomId={groupId} userId={user.id} nickname={profile.display_name} />}

          <div className="flex h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet — say hi 👋</p>}
              {messages.map((m) => {
                const p = memberMap.get(m.user_id);
                return (
                  <div key={m.id} className="rounded-lg bg-input/40 px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold" style={{ color: p?.color ?? "#999" }}>{p?.display_name ?? "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="mt-0.5 break-words text-sm">{m.body}</p>
                  </div>
                );
              })}
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Message the group…"
                className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
              <button className="rounded-md bg-gradient-to-br from-primary to-ember px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110">Send</button>
            </form>
          </div>
        </div>

        <aside className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Members ({members.length})</h3>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: m.color }}>
                  {m.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{m.display_name}{m.id === group.owner_id && <span className="ml-1 text-[10px] text-primary">★</span>}</div>
                  <div className="truncate text-[10px] text-muted-foreground">@{m.username}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
