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

// --- Processing Complete ---

export function ProcessingCompleteEmail({
  userName,
  achievementTitle,
  linkedinPostUrl,
  resumeUpdated,
  portfolioUpdated,
}: {
  userName: string;
  achievementTitle: string;
  linkedinPostUrl?: string;
  resumeUpdated: boolean;
  portfolioUpdated: boolean;
}) {
  // TODO: Implement processing complete email template
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hi {userName}, your achievement has been processed.</Text>
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
