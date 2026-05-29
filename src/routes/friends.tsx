import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/auth-context";

export const Route = createFileRoute("/friends")({
  component: FriendsPage,
  head: () => ({ meta: [{ title: "Friends · Samu Game Hub" }] }),
});

type Row = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" };
type Enriched = Row & { other: Profile | null; incoming: boolean };

function FriendsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Enriched[]>([]);
  const [uname, setUname] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships").select("id,requester_id,addressee_id,status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const list = (data ?? []) as Row[];
    const otherIds = list.map((r) => r.requester_id === user.id ? r.addressee_id : r.requester_id);
    const profs = otherIds.length
      ? (await supabase.from("profiles").select("id,username,display_name,color").in("id", otherIds)).data as Profile[]
      : [];
    setRows(list.map((r) => {
      const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
      return { ...r, other: profs.find((p) => p.id === otherId) ?? null, incoming: r.addressee_id === user.id };
    }));
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel("friends-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (loading) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  if (!user) return <Shell><LoginPrompt /></Shell>;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    const clean = uname.trim().toLowerCase();
    if (!clean) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("username", clean).maybeSingle();
    if (!prof) { setMsg("No user with that name."); return; }
    if (prof.id === user.id) { setMsg("That's you 🙂"); return; }
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: prof.id });
    if (error) setMsg(error.message);
    else { setMsg("Friend request sent!"); setUname(""); }
  };

  const accept = async (id: string) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
  };
  const remove = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
  };

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.incoming);
  const outgoing = rows.filter((r) => r.status === "pending" && !r.incoming);

  return (
    <Shell>
      <h1 className="text-4xl font-black tracking-tight">Friends</h1>
      <p className="mt-1 text-muted-foreground">Find players by username and play together.</p>

      <form onSubmit={add} className="mt-6 flex gap-2 rounded-xl border border-border bg-card p-4">
        <input value={uname} onChange={(e) => setUname(e.target.value)} placeholder="Add friend by username…"
          className="flex-1 rounded-md border border-border bg-input px-3 py-2 outline-none focus:border-primary" />
        <button className="rounded-md bg-gradient-to-br from-primary to-ember px-4 py-2 font-bold text-primary-foreground hover:brightness-110">Send request</button>
      </form>
      {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}

      <Section title={`Incoming requests (${incoming.length})`}>
        {incoming.map((r) => (
          <Card key={r.id} prof={r.other}>
            <button onClick={() => accept(r.id)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110">Accept</button>
            <button onClick={() => remove(r.id)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive">Decline</button>
          </Card>
        ))}
      </Section>

      <Section title={`Your friends (${accepted.length})`}>
        {accepted.map((r) => (
          <Card key={r.id} prof={r.other}>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase text-primary">friends</span>
            <button onClick={() => remove(r.id)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive">Remove</button>
          </Card>
        ))}
      </Section>

      <Section title={`Pending (${outgoing.length})`}>
        {outgoing.map((r) => (
          <Card key={r.id} prof={r.other}>
            <span className="text-xs text-muted-foreground">waiting…</span>
            <button onClick={() => remove(r.id)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive">Cancel</button>
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
      <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</h2>
      {arr.length === 0 ? <p className="text-sm text-muted-foreground/70">Nothing here yet.</p> : <div className="space-y-2">{children}</div>}
    </div>
  );
}

function Card({ prof, children }: { prof: Profile | null; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: prof?.color ?? "#666" }}>
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
      <Link to="/auth" className="inline-block rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">Sign in</Link>
    </div>
  );
}
