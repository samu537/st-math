import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { loadGames, type Game } from "@/lib/games-store";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Samu Game Hub — Play Games" },
      { name: "description", content: "A red-and-black arcade. Browse and play HTML5 and web games on Samu Game Hub." },
    ],
  }),
});

function Index() {
  const [games, setGames] = useState<Game[]>([]);
  useEffect(() => { loadGames().then(setGames); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.25_27/.35),transparent_60%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(transparent_95%,oklch(0.3_0.08_27/.4)_95%),linear-gradient(90deg,transparent_95%,oklch(0.3_0.08_27/.4)_95%)] bg-[size:48px_48px]" />
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Live arcade · {games.length} {games.length === 1 ? "game" : "games"}
            </div>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Welcome to <span className="bg-gradient-to-br from-primary to-ember bg-clip-text text-transparent">Samu</span>
              <br />Game Hub.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Bite-sized HTML5 games, hand-picked and ready to play in your browser. One click to launch, one tap to go fullscreen.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        {games.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-16 text-center">
            <p className="text-lg text-muted-foreground">No games yet.</p>
            <Link to="/admin" className="mt-4 inline-block font-semibold text-primary hover:underline">
              Add the first one →
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-2xl font-black tracking-tight md:text-3xl">
                Trending <span className="text-primary">Now</span>
              </h2>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {games.length} {games.length === 1 ? "title" : "titles"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((g) => (
                <Link
                  key={g.id}
                  to="/play/$gameId"
                  params={{ gameId: g.id }}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition duration-300 hover:z-10 hover:scale-[1.02] hover:border-primary hover:shadow-[0_0_40px_-5px_var(--color-primary)]"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                    {g.image ? (
                      <img
                        src={g.image}
                        alt={g.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl font-black text-primary/30">
                        {g.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-1 text-lg font-bold">{g.title}</h3>
                    {g.description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{g.description}</p>
                    )}
                    <div className="mt-auto pt-2 text-sm font-semibold text-primary">
                      ▶ Play now
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Samu Game Hub · Built for play
      </footer>
    </div>
  );
}
