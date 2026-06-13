import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Hr,
} from "@react-email/components";

// --- Achievement Complete ---

export function AchievementCompleteEmail({
  userName,
  achievementType,
  resumeUpdated,
  portfolioUpdated,
  reviewUrl,
}: {
  userName: string;
  achievementType: string;
  resumeUpdated: boolean;
  portfolioUpdated: boolean;
  reviewUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#111", color: "#eee", fontFamily: "sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "20px" }}>
          <Text style={{ fontSize: "24px", color: "#10b981" }}>Achievement Processed!</Text>
          <Text>Hi {userName},</Text>
          <Text>Your {achievementType} achievement has been fully processed.</Text>

          <Text style={{ marginBottom: "5px" }}>
            {resumeUpdated ? "✅" : "❌"} Resume Updated
          </Text>
          <Text style={{ marginTop: "0px" }}>
            {portfolioUpdated ? "✅" : "❌"} Portfolio Updated
          </Text>

          <Hr style={{ borderColor: "#333", margin: "20px 0" }} />

          {reviewUrl && (
            <Link
              href={reviewUrl}
              style={{
                backgroundColor: "#10b981",
                color: "#111",
                padding: "10px 20px",
                borderRadius: "5px",
                textDecoration: "none",
                display: "inline-block",
                fontWeight: "bold"
              }}
            >
              Review Your Posts →
            </Link>
          )}
        </Container>
      </Body>
    </Html>
  );
}

// --- Welcome Email ---

export function WelcomeEmail({
  userName,
}: {
  userName: string;
}) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#fff", color: "#333", fontFamily: "sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "20px" }}>
          <Text style={{ fontSize: "24px", fontWeight: "bold" }}>Welcome to Career Autopilot, {userName}!</Text>
          <Text>Follow these 3 easy steps to get started:</Text>

          <Text>1️⃣ <strong>Link Accounts</strong> - Connect your LinkedIn and X accounts.</Text>
          <Text>2️⃣ <strong>Upload Resume</strong> - Add your current resume so we can improve it.</Text>
          <Text>3️⃣ <strong>Log Achievements</strong> - Start adding your wins!</Text>

          <Hr style={{ borderColor: "#ccc", margin: "20px 0" }} />

          <Link
            href="https://career-autopilot.com/dashboard"
            style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: "5px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: "bold"
            }}
          >
            Log Your First Achievement →
          </Link>
        </Container>
      </Body>
    </Html>
  );
}

// --- Upgrade Confirmation Email ---

export function UpgradeConfirmationEmail({
  userName,
  plan,
  nextBillingDate,
}: {
  userName: string;
  plan: string;
  nextBillingDate: Date;
}) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#fff", color: "#333", fontFamily: "sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "20px" }}>
          <Text style={{ fontSize: "24px", fontWeight: "bold" }}>Upgrade Successful!</Text>
          <Text>Hi {userName},</Text>
          <Text>Thank you for upgrading to the <strong>{plan}</strong> plan.</Text>

          <Text>Your new features include:</Text>
          <ul>
            <li>Unlimited achievement logging</li>
            <li>AI Resume & Portfolio generation</li>
            <li>Priority support</li>
          </ul>

          <Text>Your next billing date is {nextBillingDate.toLocaleDateString()}.</Text>
        </Container>
      </Body>
    </Html>
  );
}

// --- Payment Failed Email ---

export function PaymentFailedEmail({
  userName,
  retryUrl,
}: {
  userName: string;
  retryUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#fff", color: "#333", fontFamily: "sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "20px" }}>
          <Text style={{ fontSize: "24px", fontWeight: "bold", color: "#e11d48" }}>Payment Failed</Text>
          <Text>Hi {userName},</Text>
          <Text>We couldn&apos;t process your latest payment. Please update your payment method to keep your account active.</Text>

          <Hr style={{ borderColor: "#ccc", margin: "20px 0" }} />

          <Link
            href={retryUrl}
            style={{
              backgroundColor: "#e11d48",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: "5px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: "bold"
            }}
          >
            Update Payment Method
          </Link>
        </Container>
      </Body>
    </Html>
  );
}

// --- Publish Success ---

export function PublishSuccessEmail({
  userName,
  postUrl,
}: {
  userName: string;
  postUrl: string;
}) {
  // TODO: Implement publish success email template
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Your post is live: <Link href={postUrl}>{postUrl}</Link></Text>
        </Container>
      </Body>
    </Html>
  );
}

// --- Pipeline Failure ---

export function PipelineFailureEmail({
  userName,
  step,
  reason,
  retryUrl,
}: {
  userName: string;
  step: string;
  reason: string;
  retryUrl: string;
}) {
  // TODO: Implement pipeline failure email template
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hi {userName}, the {step} step failed: {reason}</Text>
          <Link href={retryUrl}>Retry</Link>
        </Container>
      </Body>
    </Html>
  );
}

// --- Monthly Summary ---

export function MonthlySummaryEmail({
  userName,
  achievementsLogged,
  postsPublished,
  resumeUpdates,
}: {
  userName: string;
  achievementsLogged: number;
  postsPublished: number;
  resumeUpdates: number;
}) {
  // TODO: Implement monthly summary email template
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hi {userName}, here is your monthly summary.</Text>
        </Container>
      </Body>
    </Html>
  );
}
