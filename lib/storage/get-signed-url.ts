import { getStorageClient } from './client';

export async function getResumeSignedUrl(filePath: string): Promise<string> {
  // Pass through empty paths or data URIs (e.g. used by QStash route stubs)
  if (!filePath || filePath.startsWith('data:')) {
    return filePath;
  }

  // If the filePath is already a full URL (e.g. an old public URL), we should try to extract the storage path.
  // The PRD says "Wait — we can't rename the column easily. Instead: Store the file path (not a signed URL) in resume_versions.fileUrl. When reading: call a getSignedUrl() helper to generate fresh signed URL."
  // It's possible some old rows have full URLs. Let's handle both.
  let storagePath = filePath;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const url = new URL(filePath);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
      if (match) {
        // match[1] is bucket (e.g., resumes)
        // match[2] is path (e.g., resumes/userId/timestamp.pdf)
        // Wait, the path inside bucket is match[2]. But Supabase createSignedUrl needs the path *inside* the bucket.
        // E.g., if url is .../object/public/resumes/resumes/userId/timestamp.pdf, bucket is 'resumes' and path is 'resumes/userId/timestamp.pdf'
        // Let's assume bucket is 'resumes'. So we just take match[2].
        if (match[1] === 'resumes') {
            storagePath = match[2];
        } else {
            // It might be a URL to another bucket, skip signing? Let's try to sign it from 'resumes' bucket anyway, or just return the original URL if it's not the 'resumes' bucket.
            if (match[1] !== 'resumes') {
                return filePath;
            }
        }
      } else {
        return filePath;
      }
    } catch {
      return filePath;
    }
  }

  const supabase = getStorageClient();
  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour

  if (error) {
    console.error('[getResumeSignedUrl] Failed to generate signed URL:', error);
    // Fallback to the original path/url if signing fails
    return filePath;
  }

  return data.signedUrl;
}
