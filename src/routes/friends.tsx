import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { VoiceRoom } from "@/components/VoiceRoom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/auth-context";

export const Route = createFileRoute("/friends")({
  component: FriendsPage,
  head: () => ({ meta: [{ title: "Friends · Samu Game Hub" }] }),
});

type Row = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};
type Enriched = Row & { other: Profile | null; incoming: boolean };
type VoiceCall = {
  id: string;
  caller_id: string;
  callee_id: string;
  room_id: string;
  status: "ringing" | "answered" | "declined" | "ended";
  created_at: string;
};

function FriendsPage() {
  const { user, profile, loading } = useAuth();
  const [rows, setRows] = useState<Enriched[]>([]);
  const [activeCall, setActiveCall] = useState<VoiceCall | null>(null);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [callProfiles, setCallProfiles] = useState<Record<string, Profile>>({});

  const [uname, setUname] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select("id,requester_id,addressee_id,status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const list = (data ?? []) as Row[];
    const otherIds = list.map((r) =>
      r.requester_id === user.id ? r.addressee_id : r.requester_id,
    );
    const profs = otherIds.length
      ? ((
          await supabase
            .from("profiles")
            .select("id,username,display_name,color")
            .in("id", otherIds)
        ).data as Profile[])
      : [];
    setRows(
      list.map((r) => {
        const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
        return {
          ...r,
          other: profs.find((p) => p.id === otherId) ?? null,
          incoming: r.addressee_id === user.id,
        };
      }),
    );
  };

  const loadCalls = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("voice_calls")
      .select("id,caller_id,callee_id,room_id,status,created_at")
      .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
      .in("status", ["ringing", "answered"])
      .order("created_at", { ascending: false });
    const list = (data ?? []) as VoiceCall[];
    setCalls(list);
    setActiveCall((current) =>
      current && list.some((call) => call.id === current.id)
        ? list.find((call) => call.id === current.id)!
        : (list[0] ?? null),
    );
    const ids = Array.from(
      new Set(
        list.flatMap((call) => [call.caller_id, call.callee_id]).filter((id) => id !== user.id),
      ),
    );
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,color")
        .in("id", ids);
      setCallProfiles((prev) => ({
        ...prev,
        ...Object.fromEntries(((profs ?? []) as Profile[]).map((p) => [p.id, p])),
      }));
    }
  };

  const loadRef = useRef(load);
  const loadCallsRef = useRef(loadCalls);
  loadRef.current = load;
  loadCallsRef.current = loadCalls;

  useEffect(() => {
    if (!user) return;
    void loadRef.current();
    void loadCallsRef.current();
    const ch = supabase
      .channel("friends-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void loadRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_calls" }, () => {
        void loadCallsRef.current();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (loading)
    return (
      <Shell>
        <p className="text-muted-foreground">Loading…</p>
      </Shell>
    );
  if (!user)
    return (
      <Shell>
        <LoginPrompt />
      </Shell>
    );

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    const clean = uname.trim().toLowerCase();
    if (!clean) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", clean)
      .maybeSingle();
    if (!prof) {
      setMsg("No user with that name.");
      return;
    }
    if (prof.id === user.id) {
      setMsg("That's you 🙂");
      return;
    }
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user.id, addressee_id: prof.id });
    if (error) setMsg(error.message);
    else {
      setMsg("Friend request sent!");
      setUname("");
    }
  };

  const accept = async (id: string) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
  };
  const remove = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
  };

  const roomFor = (friendId: string) => `dm-${[user.id, friendId].sort().join("-")}`;

  const startCall = async (friend: Profile) => {
    setMsg("");
    const { data, error } = await supabase
      .from("voice_calls")
      .insert({
        caller_id: user.id,
        callee_id: friend.id,
        room_id: roomFor(friend.id),
        status: "ringing",
      })
      .select("id,caller_id,callee_id,room_id,status,created_at")
      .single();
    if (error) {
      setMsg(error.message);
      return;
    }
    const call = data as VoiceCall;
    setCallProfiles((prev) => ({ ...prev, [friend.id]: friend }));
    setCalls((prev) => [call, ...prev]);
    setActiveCall(call);
  };

  const answerCall = async (call: VoiceCall) => {
    await supabase.from("voice_calls").update({ status: "answered" }).eq("id", call.id);
    setActiveCall({ ...call, status: "answered" });
    await loadCalls();
  };

  const finishCall = async (call: VoiceCall, status: "declined" | "ended" = "ended") => {
    await supabase.from("voice_calls").update({ status }).eq("id", call.id);
    setCalls((prev) => prev.filter((x) => x.id !== call.id));
    setActiveCall((current) => (current?.id === call.id ? null : current));
  };

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.incoming);
  const outgoing = rows.filter((r) => r.status === "pending" && !r.incoming);
  const incomingCalls = calls.filter(
    (call) => call.callee_id === user.id && call.status === "ringing",
  );
  const activeFriendId = activeCall
    ? activeCall.caller_id === user.id
      ? activeCall.callee_id
      : activeCall.caller_id
    : null;
  const activeFriend = activeFriendId
    ? (callProfiles[activeFriendId] ??
      accepted.find((r) => r.other?.id === activeFriendId)?.other ??
      null)
    : null;

  return (
    <Shell>
      <h1 className="text-4xl font-black tracking-tight">Friends</h1>
      <p className="mt-1 text-muted-foreground">Find players by username and play together.</p>

      <form onSubmit={add} className="mt-6 flex gap-2 rounded-xl border border-border bg-card p-4">
        <input
          value={uname}
          onChange={(e) => setUname(e.target.value)}
          placeholder="Add friend by username…"
          className="flex-1 rounded-md border border-border bg-input px-3 py-2 outline-none focus:border-primary"
        />
        <button className="rounded-md bg-gradient-to-br from-primary to-ember px-4 py-2 font-bold text-primary-foreground hover:brightness-110">
          Send request
        </button>
      </form>
      {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}

      {incomingCalls.length > 0 && (
        <div className="mt-6 space-y-2">
          {incomingCalls.map((call) => {
            const caller =
              callProfiles[call.caller_id] ??
              accepted.find((r) => r.other?.id === call.caller_id)?.other;
            return (
              <div
                key={call.id}
                className="flex items-center gap-3 rounded-lg border border-primary/50 bg-primary/10 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-widest text-primary">
                    Incoming call
                  </div>
                  <div className="truncate font-bold">
                    {caller?.display_name ?? "Friend"} is calling…
                  </div>
                </div>
                <button
                  onClick={() => answerCall(call)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"
                >
                  Answer
                </button>
                <button
                  onClick={() => finishCall(call, "declined")}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
                >
                  Decline
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Section title={`Incoming requests (${incoming.length})`}>
        {incoming.map((r) => (
          <Card key={r.id} prof={r.other}>
            <button
              onClick={() => accept(r.id)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"
            >
              Accept
            </button>
            <button
              onClick={() => remove(r.id)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
            >
              Decline
            </button>
          </Card>
        ))}
      </Section>

      <Section title={`Your friends (${accepted.length})`}>
        {accepted.map((r) => (
          <Card key={r.id} prof={r.other}>
            {r.other && (
              <button
                onClick={() =>
                  activeFriendId === r.other!.id && activeCall
                    ? finishCall(activeCall)
                    : startCall(r.other!)
                }
                className="rounded-md bg-gradient-to-br from-primary to-ember px-3 py-1.5 text-xs font-black uppercase tracking-wider text-primary-foreground hover:brightness-110"
              >
                {activeFriendId === r.other.id ? "✕ End" : "📞 Call"}
              </button>
            )}
            <button
              onClick={() => remove(r.id)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          </Card>
        ))}
      </Section>

      {activeCall &&
        user &&
        activeFriend &&
        (activeCall.status === "answered" || activeCall.caller_id === user.id) && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              {activeCall.status === "ringing"
                ? `Ringing ${activeFriend.display_name}…`
                : `In call with ${activeFriend.display_name}`}
            </div>
            <VoiceRoom
              roomId={activeCall.room_id}
              userId={user.id}
              nickname={profile?.display_name ?? "you"}
              autoJoin
              onLeave={() => finishCall(activeCall)}
            />
          </div>
        )}

      <Section title={`Pending (${outgoing.length})`}>
        {outgoing.map((r) => (
          <Card key={r.id} prof={r.other}>
            <span className="text-xs text-muted-foreground">waiting…</span>
            <button
              onClick={() => remove(r.id)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
            >
              Cancel
            </button>
          </Card>
        ))}
      </Section>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {arr.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">Nothing here yet.</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function Card({ prof, children }: { prof: Profile | null; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
        style={{ backgroundColor: prof?.color ?? "#666" }}
      >
        {(prof?.display_name ?? "?").slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{prof?.display_name ?? "Unknown"}</div>
        <div className="text-xs text-muted-foreground">@{prof?.username}</div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">{children}</div>
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="mb-4">Sign in to manage friends.</p>
      <Link
        to="/auth"
        className="inline-block rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground"
      >
        Sign in
      </Link>
    </div>
  );
}
