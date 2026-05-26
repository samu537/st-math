import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { addGame, deleteGame, loadGames, type Game } from "@/lib/games-store";

const PASSWORD = "samy0713";
const AUTH_KEY = "samu_admin_ok";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin · Samu Game Hub" }, { name: "robots", content: "noindex" }],
  }),
});

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY) === "1") setAuthed(true);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pwd === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      setAuthed(true);
    } else {
      setErr("Incorrect password.");
      setPwd("");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto flex max-w-md flex-col px-6 py-24">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_0_60px_-20px_var(--color-primary)]">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-2xl">🔒</div>
              <h1 className="text-2xl font-black">Admin Access</h1>
              <p className="mt-2 text-sm text-muted-foreground">Enter the password to manage games.</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <input
                type="password"
                autoFocus
                placeholder="Password"
                value={pwd}
                onChange={(e) => { setPwd(e.target.value); setErr(""); }}
                className="w-full rounded-md border border-border bg-input px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <button
                type="submit"
                className="w-full rounded-md bg-gradient-to-br from-primary to-ember px-4 py-3 font-bold text-primary-foreground shadow-[0_0_24px_-4px_var(--color-primary)] transition hover:brightness-110"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const [games, setGames] = useState<Game[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [type, setType] = useState<"url" | "html">("url");
  const [content, setContent] = useState("");

  const refresh = () => { loadGames().then(setGames); };
  useEffect(() => { refresh(); }, []);

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    await addGame({ title: title.trim(), description: description.trim(), image: image.trim(), type, content: content.trim() });
    setTitle(""); setDescription(""); setImage(""); setContent("");
    refresh();
  };

  const remove = async (id: string) => {
    if (confirm("Delete this game?")) { await deleteGame(id); refresh(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Admin Console</h1>
            <p className="mt-1 text-muted-foreground">Add, manage, and remove games.</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(AUTH_KEY); location.reload(); }}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
          >
            Sign out
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold">Add a game</h2>

            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} placeholder="Crimson Runner" />
            </Field>

            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} rows={2} placeholder="Short summary..." />
            </Field>

            <Field label="Cover image (URL or upload)">
              <input value={image} onChange={(e) => setImage(e.target.value)} className={inputCls} placeholder="https://..." />
              <div className="mt-2 flex items-center gap-3">
                <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                  Upload file
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
                </label>
                {image && <img src={image} alt="preview" className="h-12 w-20 rounded object-cover" />}
              </div>
            </Field>

            <Field label="Game source">
              <div className="mb-2 inline-flex rounded-md border border-border bg-input p-1">
                {(["url", "html"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                      type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "url" ? "Link / URL" : "HTML5 code"}
                  </button>
                ))}
              </div>
              {type === "url" ? (
                <input value={content} onChange={(e) => setContent(e.target.value)} required className={inputCls} placeholder="https://play2048.co/" />
              ) : (
                <textarea value={content} onChange={(e) => setContent(e.target.value)} required className={inputCls} rows={6} placeholder="<!DOCTYPE html><html>..." />
              )}
            </Field>

            <button type="submit" className="w-full rounded-md bg-gradient-to-br from-primary to-ember px-4 py-3 font-bold text-primary-foreground shadow-[0_0_24px_-4px_var(--color-primary)] transition hover:brightness-110">
              + Add game
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">Library ({games.length})</h2>
            {games.length === 0 && <p className="text-muted-foreground">No games yet.</p>}
            {games.map((g) => (
              <div key={g.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-secondary">
                  {g.image && <img src={g.image} alt={g.title} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{g.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{g.type.toUpperCase()} · {g.content.slice(0, 60)}</div>
                </div>
                <button onClick={() => remove(g.id)} className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-input px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
