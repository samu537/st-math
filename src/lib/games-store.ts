import { supabase } from "@/integrations/supabase/client";

export type Game = {
  id: string;
  title: string;
  description: string;
  image: string;
  type: "url" | "html";
  content: string;
  createdAt: number;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  type: string;
  content: string;
  created_at: string;
};

const toGame = (r: Row): Game => ({
  id: r.id,
  title: r.title,
  description: r.description ?? "",
  image: r.image ?? "",
  type: (r.type === "html" ? "html" : "url") as "url" | "html",
  content: r.content,
  createdAt: new Date(r.created_at).getTime(),
});

export async function loadGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadGames", error);
    return [];
  }
  return (data as Row[]).map(toGame);
}

export async function getGame(id: string): Promise<Game | null> {
  const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toGame(data as Row);
}

export async function addGame(g: Omit<Game, "id" | "createdAt">): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      title: g.title,
      description: g.description,
      image: g.image,
      type: g.type,
      content: g.content,
    })
    .select()
    .single();
  if (error) {
    console.error("addGame", error);
    return null;
  }
  return toGame(data as Row);
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) console.error("deleteGame", error);
}
