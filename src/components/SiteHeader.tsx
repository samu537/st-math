import { Link } from "@tanstack/react-router";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useAuth } from "@/lib/auth-context";

export function SiteHeader() {
  const { user, profile, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
        <Link to="/" className="group flex items-center gap-3">
          <div className="relative h-9 w-9">
            <div className="absolute inset-0 rotate-45 rounded-md bg-gradient-to-br from-primary to-ember shadow-[0_0_24px_var(--color-primary)] transition-transform group-hover:rotate-[135deg]" />
            <div className="absolute inset-[6px] rotate-45 rounded-sm bg-background" />
          </div>
          <div className="leading-none">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Samu</div>
            <div className="text-lg font-black tracking-tight">GAME HUB</div>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1.5 text-sm">
          <NavLink to="/">Library</NavLink>
          {user && <NavLink to="/friends">Friends</NavLink>}

          <Link to="/admin" className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 font-semibold text-primary hover:bg-primary/20">Admin</Link>
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 sm:flex">
                <div className="h-6 w-6 rounded-full text-center text-[10px] font-black leading-6 text-white" style={{ backgroundColor: profile?.color ?? "#666" }}>
                  {(profile?.display_name ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-bold">{profile?.display_name ?? "you"}</span>
              </div>
              <button onClick={signOut} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive">Sign out</button>
            </div>
          ) : (
            <Link to="/auth" className="rounded-md bg-gradient-to-br from-primary to-ember px-4 py-2 font-bold text-primary-foreground hover:brightness-110">Sign in</Link>
          )}
          <SettingsPanel />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-2 font-medium text-muted-foreground transition hover:text-foreground"
      activeOptions={{ exact: to === "/" }}
      activeProps={{ className: "rounded-md px-3 py-2 font-medium text-foreground" }}
    >
      {children}
    </Link>
  );
}
