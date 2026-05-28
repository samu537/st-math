import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in · Samu Game Hub" }] }),
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (clean.length < 3) throw new Error("Username must be at least 3 characters (letters, numbers, _).");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: clean, display_name: clean }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col px-6 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_0_60px_-20px_var(--color-primary)]">
          <div className="mb-6 flex rounded-lg border border-border bg-input p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErr(""); }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-bold uppercase tracking-wider transition ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Username (a-z, 0-9, _)" className={ip} />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className={ip} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password (min 6 chars)" className={ip} />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <button disabled={busy} type="submit" className="w-full rounded-md bg-gradient-to-br from-primary to-ember px-4 py-3 font-bold text-primary-foreground shadow-[0_0_24px_-4px_var(--color-primary)] transition hover:brightness-110 disabled:opacity-50">
              {busy ? "..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-primary">← back to library</Link>
        </div>
      </div>
    </div>
  );
}

const ip = "w-full rounded-md border border-border bg-input px-3 py-2.5 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";
