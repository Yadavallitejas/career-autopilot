import { env } from "@/lib/env";
import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY, emails will not be sent");
      // Create a dummy resend client if there's no API key
      _resend = {
        emails: {
          send: async () => ({ id: "mock-id", data: null, error: null }),
        },
      } as unknown as Resend;
    } else {
      _resend = new Resend(env.RESEND_API_KEY);
    }
  }
  return _resend;
}

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
}): Promise<void> {
  try {
    const resend = getResend();

    const domain = env.NEXT_PUBLIC_APP_URL
      ? new URL(env.NEXT_PUBLIC_APP_URL).hostname
      : "career-autopilot.com";

    const { error, data } = await resend.emails.send({
      from: `Career Autopilot <noreply@${domain}>`,
      to,
      subject,
      react,
    });

    if (error) {
      console.error("[email] Send failed:", error);
    } else {
      console.log(`[email] Sent successfully to ${to}, id: ${data?.id}`);
    }
  } catch (err) {
    console.error("[email] Unexpected error during sendEmail:", err);
  }
}
