import { callAi } from "./client";

export interface BrandVoiceProfile {
  tone: string[];
  writingStyle: string;
  commonPhrases: string[];
  avoidPhrases: string[];
}

export async function extractBrandVoice(
  writingSamples: string[]
): Promise<BrandVoiceProfile> {
  // TODO: Analyze writing samples and return brand voice characteristics
  throw new Error("Not implemented");
}

export async function applyBrandVoice(
  content: string,
  voiceProfile: BrandVoiceProfile
): Promise<string> {
  // TODO: Rewrite content to match the user's brand voice
  throw new Error("Not implemented");
}
