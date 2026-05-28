import { Link } from "@tanstack/react-router";
import { SettingsPanel } from "@/components/SettingsPanel";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/"
            className="rounded-md px-4 py-2 font-medium text-muted-foreground transition hover:text-foreground"
            activeOptions={{ exact: true }}
            activeProps={{ className: "rounded-md px-4 py-2 font-medium text-foreground" }}
          >
            Library
          </Link>
          <Link
            to="/admin"
            className="rounded-md border border-primary/50 bg-primary/10 px-4 py-2 font-semibold text-primary transition hover:border-primary hover:bg-primary/20"
          >
            Admin
          </Link>
          <SettingsPanel />
        </nav>
      </div>
    </header>
  );
}
