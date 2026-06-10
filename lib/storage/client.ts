import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;

export function getStorageClient() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  contentType: string
): Promise<string> {
  // TODO: Upload to Supabase Storage, return public URL
  throw new Error("Not implemented");
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  // TODO: Delete file from Supabase Storage
  throw new Error("Not implemented");
}
