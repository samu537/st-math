import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminAuthInput = {
  password: string;
};

type AdminGameInput = AdminAuthInput & {
  title: string;
  description: string;
  image: string;
  type: "url" | "html";
  content: string;
  published?: boolean;
};

type AdminGameActionInput = AdminAuthInput & {
  id: string;
};

type AdminPublishInput = AdminGameActionInput & {
  published: boolean;
};

const gamesTable = () => supabaseAdmin.from("games") as any;

const assertAdmin = (password: string) => {
  const expectedPassword = process.env.SAMU_ADMIN_PASSWORD ?? "samy0713";
  if (password !== expectedPassword) {
    throw new Error("Incorrect admin password");
  }
};

const gameSelect = "id,title,description,image,type,content,created_at,published";

const toGame = (row: any) => ({
  id: row.id as string,
  title: row.title as string,
  description: (row.description ?? "") as string,
  image: (row.image ?? "") as string,
  type: row.type === "html" ? "html" as const : "url" as const,
  content: row.content as string,
  createdAt: new Date(row.created_at as string).getTime(),
  published: Boolean(row.published),
});

const validateAuth = (input: unknown): AdminAuthInput => {
  if (!input || typeof input !== "object") throw new Error("Missing admin password");
  const password = (input as Record<string, unknown>).password;
  if (typeof password !== "string") throw new Error("Missing admin password");
  return { password };
};

const validateGame = (input: unknown): AdminGameInput => {
  const auth = validateAuth(input);
  const value = input as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const image = typeof value.image === "string" ? value.image.trim() : "";
  const type = value.type === "html" ? "html" : "url";
  const content = typeof value.content === "string" ? value.content.trim() : "";
  const published = value.published === true;

  if (!title || title.length > 120) throw new Error("Game title is required");
  if (description.length > 500) throw new Error("Description is too long");
  if (!content || content.length > 500_000) throw new Error("Game source is required");
  if (image.length > 1_500_000) throw new Error("Cover image is too large");

  return { ...auth, title, description, image, type, content, published };
};

const validateAction = (input: unknown): AdminGameActionInput => {
  const auth = validateAuth(input);
  const id = (input as Record<string, unknown>).id;
  if (typeof id !== "string" || !id) throw new Error("Missing game id");
  return { ...auth, id };
};

const validatePublish = (input: unknown): AdminPublishInput => {
  const action = validateAction(input);
  const published = (input as Record<string, unknown>).published;
  if (typeof published !== "boolean") throw new Error("Missing publish status");
  return { ...action, published };
};

export const listAdminGames = createServerFn({ method: "POST" })
  .inputValidator(validateAuth)
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { data: rows, error } = await gamesTable()
      .select(gameSelect)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (rows ?? []).map(toGame);
  });

export const createAdminGame = createServerFn({ method: "POST" })
  .inputValidator(validateGame)
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { password: _password, ...game } = data;
    const { data: row, error } = await gamesTable()
      .insert({
        title: game.title,
        description: game.description,
        image: game.image,
        type: game.type,
        content: game.content,
        published: game.published ?? false,
      })
      .select(gameSelect)
      .single();

    if (error) throw new Error(error.message);
    return toGame(row);
  });

export const setAdminGamePublished = createServerFn({ method: "POST" })
  .inputValidator(validatePublish)
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { data: row, error } = await gamesTable()
      .update({ published: data.published })
      .eq("id", data.id)
      .select(gameSelect)
      .single();

    if (error) throw new Error(error.message);
    return toGame(row);
  });

export const deleteAdminGame = createServerFn({ method: "POST" })
  .inputValidator(validateAction)
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { error } = await gamesTable().delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });