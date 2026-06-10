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

export async function enqueueAchievementJob(
  job: AchievementJob
): Promise<string> {
  // TODO: Publish job to QStash targeting /api/webhooks/qstash
  throw new Error("Not implemented");
}
