import { supabase } from "@/integrations/supabase/client";

export type Game = {
  id: string;
  title: string;
  description: string;
  image: string;
  type: "url" | "html";
  content: string;
  createdAt: number;
  published: boolean;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  type: string;
  content: string;
  created_at: string;
  published: boolean | null;
};

const toGame = (r: Row): Game => ({
  id: r.id,
  title: r.title,
  description: r.description ?? "",
  image: r.image ?? "",
  type: (r.type === "html" ? "html" : "url") as "url" | "html",
  content: r.content,
  createdAt: new Date(r.created_at).getTime(),
  published: r.published ?? true,
});

export async function loadGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id,title,description,image,type,content,created_at,published")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadGames", error);
    return [];
  }
  return (data as Row[]).map(toGame);
}

export async function getGame(id: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("id,title,description,image,type,content,created_at,published")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (error || !data) return null;
  return toGame(data as Row);
}
