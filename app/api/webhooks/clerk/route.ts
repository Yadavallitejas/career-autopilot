import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import { WelcomeEmail } from "@/lib/email/templates";
import * as React from "react";

type EmailAddress = {
  email_address: string;
  id: string;
  verification: { status: string } | null;
};

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    email_addresses: EmailAddress[];
    primary_email_address_id: string;
  };
};

type ClerkUserUpdatedEvent = {
  type: "user.updated";
  data: {
    id: string;
    email_addresses: EmailAddress[];
    primary_email_address_id: string;
  };
};

type ClerkWebhookEvent = ClerkUserCreatedEvent | ClerkUserUpdatedEvent;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET env variable");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  // Read required Svix headers
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  // Get raw body for signature verification
  const body = await req.text();

  // Verify with Svix
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkWebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Svix webhook verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  // Resolve primary email from the email_addresses array
  const getPrimaryEmail = (
    emailAddresses: EmailAddress[],
    primaryId: string
  ): string => {
    const primary = emailAddresses.find((e) => e.id === primaryId);
    return primary?.email_address ?? emailAddresses[0]?.email_address ?? "";
  };

  try {
    if (evt.type === "user.created") {
      const { id, email_addresses, primary_email_address_id } = evt.data;
      const email = getPrimaryEmail(email_addresses, primary_email_address_id);

      await db.insert(users).values({
        clerkId: id,
        email,
        plan: "free",
      });

      // Send Welcome Email
      sendEmail({
        to: email,
        subject: "Welcome to Career Autopilot",
        react: React.createElement(WelcomeEmail, {
          userName: email.split("@")[0],
        }),
      }).catch((err) => console.error("[email] Failed to send WelcomeEmail", err));

      console.log(`[clerk-webhook] Created user clerkId=${id}`);
    } else if (evt.type === "user.updated") {
      const { id, email_addresses, primary_email_address_id } = evt.data;
      const email = getPrimaryEmail(email_addresses, primary_email_address_id);

      await db.update(users).set({ email }).where(eq(users.clerkId, id));

      console.log(`[clerk-webhook] Updated user clerkId=${id}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[clerk-webhook] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
