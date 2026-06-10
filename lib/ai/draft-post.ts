import { callAi } from "./client";

export interface DraftedPosts {
  linkedin: {
    content: string;
    hashtags: string[];
    mediaSuggestion: string;
  };
  x: {
    tweet: string;
    thread: string[];
    mediaSuggestion: string;
  };
}

export async function draftPosts(
  achievementText: string,
  achievementType: string
): Promise<DraftedPosts> {
  // TODO: Call AI for both LinkedIn and X drafts in parallel
  throw new Error("Not implemented");
}
