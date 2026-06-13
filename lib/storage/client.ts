import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Singleton — use SERVICE_ROLE_KEY for all server-side ops (bypasses RLS).
// NEVER import this module from any client-side bundle.
// ---------------------------------------------------------------------------

let _supabase: ReturnType<typeof createClient> | null = null;

export function getStorageClient(): ReturnType<typeof createClient> {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

/**
 * Named singleton alias — used by builder.ts and other server-only modules.
 * Identical to getStorageClient() but tree-shakeable as a constant.
 */
export const supabase = {
  get storage() {
    return getStorageClient().storage;
  },
};

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Upload a file to Supabase Storage and return its public URL.
 *
 * @param bucket   Storage bucket name (must already exist in Supabase)
 * @param path     Destination path within the bucket, e.g. "resumes/userId/123.pdf"
 * @param file     File content as Buffer or Blob
 * @param contentType  MIME type
 * @returns        Public URL of the uploaded file
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  contentType: string
): Promise<string> {
  const client = getStorageClient();

  const { error } = await client.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: false });

  if (error) {
    throw new Error(
      `[storage] Upload failed (bucket=${bucket}, path=${path}): ${error.message}`
    );
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<void> {
  const client = getStorageClient();

  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(
      `[storage] Delete failed (bucket=${bucket}, path=${path}): ${error.message}`
    );
  }
}
