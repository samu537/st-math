import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
  head: () => ({ meta: [{ title: "Groups · Samu Game Hub" }] }),
});

type Group = { id: string; name: string; description: string; is_public: boolean; owner_id: string };

function GroupsPage() {
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<Group[]>([]);
  const [pub, setPub] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data: pubData } = await supabase
      .from("groups").select("id,name,description,is_public,owner_id")
      .eq("is_public", true).order("created_at", { ascending: false }).limit(40);
    setPub((pubData ?? []) as Group[]);
    if (user) {
      const { data: mems } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
      const ids = (mems ?? []).map((m) => m.group_id);
      if (ids.length) {
        const { data: gs } = await supabase.from("groups").select("id,name,description,is_public,owner_id").in("id", ids);
        setMine((gs ?? []) as Group[]);
      } else setMine([]);
    }
  };

  useEffect(() => { load(); }, [user]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!user) return;
    if (name.trim().length < 2) { setErr("Name too short"); return; }
    const { error } = await supabase.from("groups").insert({
      name: name.trim().slice(0, 60),
      description: desc.trim().slice(0, 200),
      is_public: isPublic,
      owner_id: user.id,
    });
    if (error) setErr(error.message);
    else { setName(""); setDesc(""); load(); }
  };

  const join = async (gid: string) => {
    if (!user) return;
    await supabase.from("group_members").insert({ group_id: gid, user_id: user.id });
    load();
  };

  if (loading) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;

  return (
    <Shell>
      <h1 className="text-4xl font-black tracking-tight">Groups</h1>
      <p className="mt-1 text-muted-foreground">Hang out, chat, and jump into voice with your crew.</p>

      {!user ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="mb-3">Sign in to create or join groups.</p>
          <Link to="/auth" className="inline-block rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={create} className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Create a group</h2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" className={ip} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" rows={2} className={ip} />
          <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-primary" />
            Public (anyone can find &amp; join)
          </label>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button className="w-full rounded-md bg-gradient-to-br from-primary to-ember px-4 py-2.5 font-bold text-primary-foreground hover:brightness-110">+ Create group</button>
        </form>
      )}

      {user && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Your groups ({mine.length})</h2>
          {mine.length === 0 ? <p className="text-sm text-muted-foreground/70">You haven't joined any group yet.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">{mine.map((g) => <GroupCard key={g.id} g={g} />)}</div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Discover public groups</h2>
        {pub.length === 0 ? <p className="text-sm text-muted-foreground/70">No public groups yet — be the first!</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pub.map((g) => {
              const joined = mine.some((m) => m.id === g.id);
              return (
                <div key={g.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold">{g.name}</div>
                      <div className="text-xs text-muted-foreground">Public</div>
                    </div>
                    {joined ? (
                      <Link to="/groups/$groupId" params={{ groupId: g.id }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Open</Link>
                    ) : user ? (
                      <button onClick={() => join(g.id)} className="rounded-md border border-primary/50 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground">Join</button>
                    ) : null}
                  </div>
                  {g.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Shell>
  );
}

function GroupCard({ g }: { g: Group }) {
  return (
    <Link to="/groups/$groupId" params={{ groupId: g.id }} className="flex flex-col rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:shadow-[0_0_24px_-8px_var(--color-primary)]">
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold">{g.name}</div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${g.is_public ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-input text-muted-foreground"}`}>
          {g.is_public ? "Public" : "Private"}
        </span>
      </div>
      {g.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
      <div className="mt-3 text-xs font-semibold text-primary">Open →</div>
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-6 py-12">{children}</div>
    </div>
  );
}

const ip = "w-full rounded-md border border-border bg-input px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";
