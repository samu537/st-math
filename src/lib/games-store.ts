export type Game = {
  id: string;
  title: string;
  description: string;
  image: string;
  type: "url" | "html";
  content: string; // URL or raw HTML
  createdAt: number;
};

const KEY = "samu_games_v1";

export function loadGames(): Game[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveGames(games: Game[]) {
  localStorage.setItem(KEY, JSON.stringify(games));
}

export function addGame(g: Omit<Game, "id" | "createdAt">): Game {
  const games = loadGames();
  const next: Game = { ...g, id: crypto.randomUUID(), createdAt: Date.now() };
  saveGames([next, ...games]);
  return next;
}

export function deleteGame(id: string) {
  saveGames(loadGames().filter((g) => g.id !== id));
}

function seed(): Game[] {
  const demo: Game[] = [
    {
      id: "demo-1",
      title: "2048",
      description: "Classic number puzzle. Combine tiles to reach 2048.",
      image: "https://play2048.co/meta/apple-touch-icon.png",
      type: "url",
      content: "https://play2048.co/",
      createdAt: Date.now(),
    },
  ];
  saveGames(demo);
  return demo;
}
