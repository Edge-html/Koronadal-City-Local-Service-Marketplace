import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "private-files";
let client: SupabaseClient | null = null;

function storageClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error("Supabase Storage is not configured. Set SUPABASE_URL and the private SUPABASE_SECRET_KEY in Vercel.");
  }
  client = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export async function uploadPrivateFile(path: string, file: File) {
  const { error } = await storageClient().storage.from(BUCKET).upload(path, file, {
    cacheControl: "0",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
}

export async function downloadPrivateFile(path: string) {
  const { data, error } = await storageClient().storage.from(BUCKET).download(path);
  if (error) throw new Error(error.message);
  return data;
}
