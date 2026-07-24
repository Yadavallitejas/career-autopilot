import { env } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Singleton — use SERVICE_ROLE_KEY for all server-side ops (bypasses RLS).
// NEVER import this module from any client-side bundle.
// ---------------------------------------------------------------------------

let _supabase: ReturnType<typeof createClient> | null = null;

export function getStorageClient(): ReturnType<typeof createClient> {
  if (!_supabase) {
    _supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!
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
 * @param file         File content as Buffer or Blob
 * @param path         Destination path within the bucket, e.g. "resumes/userId/123.pdf"
 * @param contentType  MIME type
 * @param bucket       Storage bucket name — defaults to env.SUPABASE_STORAGE_BUCKET
 * @returns            Public URL of the uploaded file
 */
export async function uploadFile(
  file: Buffer | Blob,
  path: string,
  contentType: string,
  bucket?: string
): Promise<string> {
  const bucketName = bucket ?? env.SUPABASE_STORAGE_BUCKET
  const client = getStorageClient()

  const { error } = await client.storage
    .from(bucketName)
    .upload(path, file, { contentType, upsert: true })

  if (error) {
    // Give specific, actionable error messages
    if (error.message.includes('Bucket not found')) {
      throw new Error(
        `Storage bucket "${bucketName}" does not exist. ` +
        `Create it in your Supabase dashboard → Storage → New bucket.`
      )
    }
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = client.storage.from(bucketName).getPublicUrl(path)
  return data.publicUrl
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
