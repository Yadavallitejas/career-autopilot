import { Client } from "@upstash/qstash";

let _qstash: Client | null = null;

function getQstash(): Client {
  if (!_qstash) {
    _qstash = new Client({ token: process.env.QSTASH_TOKEN! });
  }
  return _qstash;
}

export interface AchievementJob {
  achievementId: string;
  userId: string;
}

/**
 * Publishes an achievement processing job to QStash.
 * The job targets /api/webhooks/qstash where the AI pipeline runs.
 * Returns the QStash message ID.
 */
export async function enqueueAchievementJob(
  job: AchievementJob
): Promise<string> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const client = getQstash();
  const result = await client.publishJSON({
    url: `${appUrl}/api/webhooks/qstash`,
    body: job,
    // Retry up to 3 times with exponential backoff
    retries: 3,
  });

  return result.messageId;
}
