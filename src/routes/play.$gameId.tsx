import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { loadGames, type Game } from "@/lib/games-store";

export const Route = createFileRoute("/play/$gameId")({
  component: PlayPage,
});

function PlayPage() {
  const { gameId } = useParams({ from: "/play/$gameId" });
  const [game, setGame] = useState<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = loadGames().find((g) => g.id === gameId);
    setGame(g ?? null);
  }, [gameId]);

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Game not found.</p>
          <Link to="/" className="mt-4 inline-block font-semibold text-primary hover:underline">← Back to library</Link>
        </div>
      </div>
    );
  }

  const srcDoc = game.type === "html" ? game.content : undefined;
  const src = game.type === "url" ? game.content : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Library
        </Link>
        <div className="text-sm font-bold tracking-wide">{game.title}</div>
        <button
          onClick={goFullscreen}
          className="rounded-md border border-primary/60 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          ⛶ Fullscreen
        </button>
      </div>
      <div ref={containerRef} className="relative h-[calc(100vh-57px)] w-full bg-black">
        <iframe
          title={game.title}
          src={src}
          srcDoc={srcDoc}
          className="h-full w-full border-0"
          allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
          allowFullScreen
        />
      </div>
    </div>
  );
}
