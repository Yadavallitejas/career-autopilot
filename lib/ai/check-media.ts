import OpenAI from "openai";

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: "https://api.x.ai/v1",
});

export interface MediaRelevanceResult {
  isRelevant: boolean;
  description: string;
  suggestedUse: string;
}

/**
 * Uses Grok's vision model to check whether an uploaded image (certificate,
 * screenshot, photo) is relevant to the logged achievement.
 *
 * Only call this for image/* media — PDFs are NOT supported by the vision API
 * and should be handled separately as downloadable attachment references.
 *
 * Never throws — returns a safe default on any failure so the pipeline
 * continues uninterrupted.
 */
export async function checkMediaRelevance({
  imageUrl,
  achievementText,
}: {
  imageUrl: string;
  achievementText: string;
}): Promise<MediaRelevanceResult> {
  try {
    const response = await grok.chat.completions.create({
      model: "grok-2-vision-1212",
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
            {
              type: "text",
              text: `The user logged this achievement: "${achievementText}".
Does this attached image (certificate, screenshot, photo) support or relate to this achievement?
Return JSON with exactly these fields:
{
  "isRelevant": boolean,
  "description": "one-sentence description of what the image shows",
  "suggestedUse": "how to reference this image in a LinkedIn post (e.g. \\"Attach as the certificate proof image\\")"
}`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as MediaRelevanceResult;

    // Validate shape — fall back gracefully if model returns unexpected output
    if (typeof parsed.isRelevant !== "boolean") {
      throw new Error("Unexpected response shape from vision model");
    }

    return parsed;
  } catch (error) {
    console.error("[MediaCheck] Vision analysis failed (non-fatal):", error);
    return {
      isRelevant: true,
      description: "Could not analyze image",
      suggestedUse: "Attach as supporting image",
    };
  }
}
