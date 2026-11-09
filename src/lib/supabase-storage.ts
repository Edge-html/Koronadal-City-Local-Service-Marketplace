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

export async function deletePrivateFiles(prefixes: string[]) {
  const bucket = storageClient().storage.from(BUCKET);
  async function listFiles(path: string): Promise<string[]> {
    const { data, error } = await bucket.list(path, { limit: 100, offset: 0 });
    if (error) throw new Error(error.message);
    const files: string[] = [];
    for (const entry of data ?? []) {
      const objectPath = `${path}/${entry.name}`;
      if (!entry.id && !entry.metadata) files.push(...await listFiles(objectPath));
      else files.push(objectPath);
    }
    return files;
  }

  for (const prefix of prefixes) {
    for (;;) {
      const paths = await listFiles(prefix);
      if (!paths.length) break;
      for (let index = 0; index < paths.length; index += 100) {
        const { error: removeError } = await bucket.remove(paths.slice(index, index + 100));
        if (removeError) throw new Error(removeError.message);
      }
    }
  }
}
