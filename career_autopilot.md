# Product Requirements Document
# Career Autopilot — AI-Powered Career Management Platform

---

| Field | Detail |
|---|---|
| Document version | 1.0 |
| Status | Draft |
| Author | Founder / Product |
| Last updated | May 2026 |
| Classification | Internal — Confidential |

---

## Table of Contents

1. Executive Summary
2. Problem Statement
3. Product Vision & Mission
4. Target Users & Personas
5. Goals & Success Metrics
6. Assumptions & Constraints
7. Product Scope
8. Feature Requirements
9. User Stories
10. Technical Architecture
11. Database Schema
12. API Specification
13. UI & UX Requirements
14. Integration Requirements
15. Non-Functional Requirements
16. Security & Privacy
17. Release Strategy
18. Business Model & Monetization
19. Open Source Strategy
20. Risk Register
21. Future Roadmap
22. Glossary

---

## 1. Executive Summary

Career Autopilot is a freemium SaaS web application that eliminates the manual effort involved in maintaining a professional career presence. Users log a single achievement — a certification, project, promotion, or any career milestone — and the platform automatically classifies it, drafts optimized social media posts for LinkedIn and X (Twitter), updates the user's resume PDF, deploys updates to their portfolio site, and publishes content directly to connected platforms.

The core insight is that working professionals, students, and freelancers consistently fail to document and broadcast their achievements not because they are unimportant, but because the process of updating multiple platforms manually is too slow and too fragmented. Career Autopilot compresses that entire workflow into a single input.

The application is built on a zero-infrastructure-cost architecture using Vercel, Neon Postgres, Clerk Auth, Upstash, Supabase Storage, and Resend, making it free to operate until meaningful scale. Revenue is generated through a freemium model with individual Pro plans and a Team tier targeting educational institutions and placement cells.

---

## 2. Problem Statement

### 2.1 The Core Problem

When a professional completes a certification, ships a project, or receives an award, they must perform the following manual tasks to fully capture the career value of that achievement:

- Write a LinkedIn post (15–30 minutes)
- Write an X/Twitter post (5–10 minutes)
- Update their resume with a new bullet or section (10–20 minutes)
- Add the project or certification to their portfolio (20–45 minutes)
- Repeat across multiple portfolio formats (GitHub, personal site, etc.)

This totals 50–105 minutes per achievement. Most people do none of it. The achievement is lost.

### 2.2 Who Is Affected

- Students finishing bootcamps, certifications, or academic projects
- Early and mid-career professionals who change jobs or earn credentials
- Freelancers who need an active public presence to attract clients
- Recent graduates entering the job market

### 2.3 Why Existing Solutions Fail

| Existing tool | What it does | What it misses |
|---|---|---|
| LinkedIn | Social posting only | Resume, portfolio, classification |
| Rezi / Kickresume | Resume editing only | Social posting, portfolio |
| Canva / Read.cv | Portfolio only | Resume, social, AI classification |
| Buffer / Hootsuite | Social scheduling only | Resume, portfolio, career intelligence |

No existing product connects all four surfaces. Career Autopilot is the first to do so with a single input.

---

## 3. Product Vision & Mission

### 3.1 Vision

A world where every professional achievement is automatically captured, classified, and broadcast — so careers are built in parallel with the work, not in addition to it.

### 3.2 Mission

To be the AI co-pilot that ensures no career milestone goes undocumented, no matter how busy the person is.

### 3.3 Positioning Statement

For students, professionals, and freelancers who struggle to keep their career presence updated, Career Autopilot is the AI career management platform that automates the entire workflow from achievement to published content — unlike point solutions that only solve one piece of the puzzle.

---

## 4. Target Users & Personas

### 4.1 Persona 1 — The Hustling Student

**Name:** Priya, 21, B.Tech Computer Science, Year 3
**Context:** Doing internships, completing online courses, building side projects on GitHub
**Pain:** Has done a lot but her LinkedIn is empty, resume is a mess, portfolio doesn't exist
**Motivation:** Placement season is coming. She knows her weak link is personal branding.
**Willingness to pay:** Free tier user. May upgrade in final semester.
**Key feature:** Portfolio builder from scratch, GitHub integration, LinkedIn post drafts

### 4.2 Persona 2 — The Busy Mid-Career Professional

**Name:** Arjun, 31, Senior Software Engineer, 6 years of experience
**Context:** Gets certifications, ships large features, mentors juniors — but updates his resume once every 2 years when job hunting
**Pain:** Misses the compounding value of documenting achievements in real time. Recruiters never find him.
**Motivation:** Wants to passively build his personal brand without spending time on it
**Willingness to pay:** Pro plan immediately. Sees clear ROI.
**Key feature:** Auto-classification, LinkedIn auto-publish, resume versioning

### 4.3 Persona 3 — The Freelancer

**Name:** Meera, 27, Freelance UI/UX Designer
**Context:** Completes client projects constantly but rarely posts about them
**Pain:** Difficulty converting completed work into new client inquiries. Portfolio is outdated.
**Motivation:** Every post is a potential new client. Every portfolio update is a trust signal.
**Willingness to pay:** Pro plan. Time saved directly equals money earned.
**Key feature:** Portfolio auto-update, Instagram carousel generation, cover letter gen

### 4.4 Persona 4 — The Placement Coordinator

**Name:** Rahul, 38, Training & Placement Officer, Engineering College
**Context:** Manages 500 students in final year. Needs them all to have strong LinkedIn profiles and resumes before campus recruitment.
**Pain:** Manual process of helping each student update their profile. No visibility into student progress.
**Motivation:** Better placement rates = college ranking
**Willingness to pay:** Team plan, institutional billing
**Key feature:** Team/cohort dashboard, bulk onboarding, analytics per student

---

## 5. Goals & Success Metrics

### 5.1 Business Goals

| Goal | Metric | Target (Month 6) | Target (Month 12) |
|---|---|---|---|
| User acquisition | Registered users | 500 | 3,000 |
| Revenue | Monthly Recurring Revenue | ₹25,000 | ₹2,00,000 |
| Paid conversion | Free to Pro conversion rate | 5% | 8% |
| Retention | Monthly active users / registered | 30% | 45% |
| Team deals | Institutions on Team plan | 2 | 10 |

### 5.2 Product Goals

| Goal | Metric | Target |
|---|---|---|
| Core flow completion | % of users who complete first achievement | > 60% |
| AI quality | User edit rate on AI drafts | < 40% |
| Post performance | Avg LinkedIn reach per Career Autopilot post vs manual | 1.5x |
| Portfolio deploy success | Deploy success rate | > 95% |
| Resume accuracy | % of resume updates accepted without edit | > 70% |

### 5.3 Technical Goals

| Goal | Target |
|---|---|
| Page load time (dashboard) | < 2 seconds |
| AI pipeline completion time | < 30 seconds |
| API uptime | 99.5% |
| Error rate | < 1% of API requests |
| Infrastructure cost per user | < ₹5/month |

---

## 6. Assumptions & Constraints

### 6.1 Assumptions

- Users have a GitHub account or are willing to create one for portfolio deployment
- LinkedIn OAuth allows posting on behalf of users under standard developer terms
- Users are willing to review AI-drafted content before publishing
- Claude API (Anthropic) remains available at current pricing
- Vercel free tier continues to support Next.js deployments without charge for early-stage traffic

### 6.2 Constraints

- X (Twitter) API tier for posting costs $100/month — X posting will be copy-paste only until revenue supports this
- Cloudflare R2 requires a card — replaced with Supabase Storage which is card-free
- LinkedIn API review process for Marketing Developer Platform access may take 2–4 weeks
- No mobile native app in v1 — web app only, mobile-responsive
- AI processing must complete in under 60 seconds to stay within Vercel's serverless timeout on the Pro plan

---

## 7. Product Scope

### 7.1 In Scope (v1.0 — MVP)

- Achievement input (text)
- AI classification (resume-worthy vs portfolio-worthy scoring)
- LinkedIn post drafting
- X post drafting (copy-paste, no API publish)
- Resume update (auto-add bullet to existing resume or build from scratch)
- Portfolio deployment for all project types (static, React, Next.js, Python, Node, Docker)
- User authentication (Clerk)
- File uploads (certificate images, media for posts)
- Free and Pro tier enforcement
- Razorpay payments
- Email notifications (Resend)
- Settings page (connected accounts)
- Basic dashboard with achievement history

### 7.2 In Scope (v1.5 — Post-MVP)

- LinkedIn OAuth auto-publishing
- Brand voice learning
- Skill gap analysis
- Career coach chat
- Post engagement analytics
- Achievement timeline page
- Instagram carousel export
- Cover letter generator

### 7.3 Out of Scope (v1.0)

- Mobile native app (iOS / Android)
- X API auto-publishing
- Team / cohort dashboard
- Voice input
- Browser extension
- Recruiter discovery mode
- Community feed
- Developer API
- Zapier / n8n integration

---

## 8. Feature Requirements

### 8.1 Achievement Input

**FR-001: Text Achievement Input**
The system shall provide a textarea input accepting achievement descriptions between 10 and 2,000 characters. A live character counter must be displayed. The submit button must be disabled below 10 characters.

**FR-002: Input Guidance**
The system shall display contextual guidance prompts below the textarea encouraging users to include: what the achievement was, how long it took, what was learned, and any quantifiable metrics.

**FR-003: Free Tier Input Limit**
Free tier users shall be limited to 3 achievement submissions per calendar month. On submission that would exceed the limit, the system shall display an upgrade prompt before the submission is processed.

**FR-004: Submission Acknowledgement**
On successful submission, the system shall immediately return a response with the achievement ID and status "processing". The user shall be redirected to a live progress view — not made to wait for completion.

---

### 8.2 AI Classification Engine

**FR-005: Resume Score**
The system shall classify every achievement with a resume-worthiness score from 1 to 10. Score ≥ 7 triggers automatic resume update. Score < 7 notifies the user that the achievement was not added to the resume with the reason.

**FR-006: Portfolio Score**
The system shall classify every achievement with a portfolio-worthiness score from 1 to 10. The portfolio threshold is ≥ 6. A lower threshold than resume is intentional — portfolios show breadth.

**FR-007: Classification Context**
The classification AI shall receive the user's existing resume text and portfolio project list as context before scoring. A bare resume increases the likelihood of lower-scoring achievements being classified as worthy.

**FR-008: Achievement Type**
The system shall classify each achievement into one of: certification, project, award, job change, education, open source, publication, or other.

**FR-009: Classification Reasoning**
The system shall store and display to the user the AI's reasoning for its resume and portfolio scores. Users shall be able to override the classification and manually add or skip the update.

**FR-010: Response Caching**
Classification results shall be cached in Upstash Redis for 1 hour keyed by a hash of the input and resume summary to prevent redundant API calls on retry.

---

### 8.3 Social Post Drafting

**FR-011: LinkedIn Post Draft**
For every achievement, the system shall generate a LinkedIn post draft. The post must: open with a hook in the first line, include a personal insight or lesson learned, end with a question to drive engagement, and include 3–5 relevant hashtags.

**FR-012: X Post Draft**
For every achievement, the system shall generate an X/Twitter post within 280 characters. If the content warrants it, a thread continuation of up to 3 additional tweets shall be generated.

**FR-013: Platform Variants**
LinkedIn and X drafts are generated separately and independently. The tone, length, and format differ per platform. The same text shall never be used for both.

**FR-014: Media Prompt**
Alongside each social post draft, the AI shall generate a media suggestion — a specific description of what image or video the user should attach to maximize reach.

**FR-015: Post Review UI**
Before any post is published or copied, the user must pass through a review screen showing the full draft, hashtags as removable pills, the media suggestion, and an editable textarea. No post is published without review.

**FR-016: Copy to Clipboard**
All users (free and Pro) shall be able to copy any post draft to clipboard. This is the free tier publishing mechanism.

**FR-017: Direct Publish (Pro)**
Pro users with a connected LinkedIn account shall be able to publish directly from the review screen using a single "Publish to LinkedIn" button.

**FR-018: Publish Failure Handling**
If a LinkedIn publish attempt fails, the system shall: store the error, update post status to "failed", notify the user via email, and allow retry from the dashboard.

---

### 8.4 Resume Management

**FR-019: Resume Upload**
Users shall be able to upload an existing resume as a PDF or DOCX file. The system shall extract text from the uploaded file and store it as the user's current resume content.

**FR-020: Resume Build from Scratch**
If a user has no resume, the system shall offer a guided form collecting: full name, email, phone, location, LinkedIn URL, GitHub URL, professional summary, work experience entries, education, certifications, skills, and projects.

**FR-021: Resume Template Selection**
The system shall offer two resume templates at launch: Classic (single-column, ATS-friendly) and Modern (two-column with sidebar). Pro users may also upload a custom template.

**FR-022: Auto-Resume Update**
When an achievement scores ≥ 7 for resume-worthiness, the system shall automatically generate: the appropriate section to add to (e.g. Certifications, Projects, Experience), and a polished one-line bullet point following standard resume conventions.

**FR-023: Resume Versioning**
Every resume update shall create a new version record. Previous versions are preserved and accessible. Users may revert to any previous version. The current version is flagged with `is_current: true`.

**FR-024: Resume Preview**
The dashboard resume page shall display a visual preview of the current resume. Users can compare the current version to the previous version with a diff view showing added lines highlighted in green.

**FR-025: PDF Download**
Users shall be able to download their resume as a PDF at any time. Free tier PDFs include a "Made with Career Autopilot" footer watermark. Pro tier PDFs are watermark-free.

---

### 8.5 Portfolio Management

**FR-026: GitHub OAuth**
Users shall connect their GitHub account via OAuth. The system shall request permissions: read:user, repo (to create repos), and pages (to enable GitHub Pages).

**FR-027: Project Type Detection**
When a user selects a GitHub repository for portfolio deployment, the system shall automatically detect the project type by reading the repo's file structure via the GitHub API. Detection priority order: Dockerfile → package.json (parsed for framework) → requirements.txt → Gemfile → go.mod → index.html → unknown.

**FR-028: Platform Routing**
Based on detected project type, the system shall route deployment to the optimal free platform:

| Project type | Deploy target |
|---|---|
| Static HTML | GitHub Pages |
| React (CRA) | Netlify |
| Vue / Vite / Svelte | Netlify |
| Next.js | Vercel |
| Nuxt | Vercel |
| Node.js (Express/Fastify) | Render |
| Python (Flask/FastAPI/Django) | Render |
| Ruby on Rails | Render |
| Go | Render |
| Docker | Railway |

**FR-029: Deploy Confirmation**
Before triggering deployment, the system shall display to the user: the detected project type, the chosen platform, the expected build command, and the estimated deploy time. User must confirm.

**FR-030: Live Deploy URL**
After successful deployment, the system shall store and display the live URL to the user. An "Open portfolio" button links directly to the deployed site.

**FR-031: Portfolio Auto-Update**
When an achievement is classified as portfolio-worthy (score ≥ 6), the system shall add a project card or entry to the user's portfolio and trigger an automatic re-deployment. The user shall be notified when the update is live.

**FR-032: Portfolio Template**
For users without an existing portfolio site, the system shall create a new GitHub repository using a Career Autopilot-managed portfolio template and deploy it. Users may choose from three templates: Minimal, Developer, and Creative.

**FR-033: Deploy Failure Handling**
If deployment fails, the system shall log the error, notify the user, and provide a "Retry deployment" button. If two consecutive deployments fail, a support contact option shall be shown.

---

### 8.6 User Authentication & Accounts

**FR-034: Sign Up Methods**
Users shall be able to create accounts via: Google OAuth, LinkedIn OAuth, or email + password.

**FR-035: Protected Routes**
All `/dashboard/*` routes shall require authentication. Unauthenticated users are redirected to `/sign-in` with the original destination preserved as a redirect parameter.

**FR-036: User Record Creation**
On first sign-in via Clerk webhook, a user record shall be created in the database with default plan: free.

**FR-037: Connected Accounts**
Users shall be able to connect LinkedIn and GitHub accounts independently from their sign-in method. Connection status, platform, and token expiry shall be displayed in Settings.

**FR-038: Token Refresh**
LinkedIn access tokens shall be automatically refreshed before expiry. The system shall check token validity before every LinkedIn API call and refresh if the token has less than 1 hour remaining.

---

### 8.7 Notifications

**FR-039: Processing Complete Email**
When an achievement pipeline completes successfully, the system shall send an email to the user listing: which posts were drafted, whether the resume was updated, and whether the portfolio was updated, with direct links to review each.

**FR-040: Publish Success Email**
When a LinkedIn post is published directly, a confirmation email shall be sent with the post URL and basic expected performance tips.

**FR-041: Failure Email**
If any pipeline step fails, the system shall send an email with: which step failed, the reason (human-readable, not a raw error), and a link to retry.

**FR-042: Monthly Summary Email**
On the 1st of each month, users shall receive a summary: number of achievements logged, posts published, resume updates made, and a prompt to log any achievements from the past month.

---

### 8.8 Payments & Subscription

**FR-043: Plan Tiers**
The system shall support three plan tiers: Free, Pro (₹499/month or ₹3,999/year), and Team (₹299/user/month, minimum 5 users).

**FR-044: Free Tier Limits**
Free tier enforces: 3 achievements per month, LinkedIn copy-paste only (no direct publish), basic resume template only, portfolio with `username.careerautopilot.in` subdomain, watermark on resume PDF.

**FR-045: Pro Tier Features**
Pro tier unlocks: unlimited achievements, LinkedIn direct publish, custom resume template upload, custom domain for portfolio, watermark-free PDF, post performance analytics.

**FR-046: Razorpay Checkout**
Upgrade flow shall open a Razorpay payment modal loaded dynamically. On successful payment, the user's plan shall be updated in the database within 10 seconds via webhook.

**FR-047: Plan Downgrade**
If a payment fails or subscription lapses, the system shall downgrade the user to the free tier and send a notification. All user data is preserved — only features are restricted.

**FR-048: Annual Discount**
Annual Pro plan shall be offered at ₹3,999 (equivalent to ~₹333/month, 33% discount vs monthly). The annual option shall be shown prominently on the pricing page.

---

### 8.9 Dashboard & Navigation

**FR-049: Sidebar Navigation**
The dashboard shall include a persistent sidebar with: Dashboard (home), New Achievement (primary CTA), Resume, Portfolio, Settings, and an upgrade CTA for free users at the bottom.

**FR-050: Dashboard Overview**
The dashboard home shall display: usage for the current month (X of 3 achievements used for free users), a list of the 5 most recent achievements with status badges, quick stats (posts published this month, resume last updated), and a prominent "Log achievement" button.

**FR-051: Achievement Status**
Each achievement in the list shall show a status badge: Processing (yellow), Complete (green), Failed (red), or Draft (gray for posts awaiting review).

**FR-052: Empty State**
Users with no achievements shall see a clear empty state with a single CTA: "Log your first achievement". No empty tables or blank screens.

---

## 9. User Stories

### Core Flow

**US-001**
As a user, I want to describe my achievement in plain language so that I do not have to navigate complex forms or select from categories.

**Acceptance criteria:**
- Single textarea on the New Achievement page
- Accepts free-text 10–2,000 chars
- Submit triggers background processing and shows progress UI

**US-002**
As a user, I want to see a live progress indicator while my achievement is being processed so that I know the system is working and I do not have to wait on a blank page.

**Acceptance criteria:**
- 5-step progress bar: Received → Classifying → Drafting posts → Updating resume → Updating portfolio
- Each step updates in real time via polling
- On complete, success message with links to review outputs

**US-003**
As a user, I want the AI to tell me why it did or did not add an achievement to my resume so that I can understand and trust the classification.

**Acceptance criteria:**
- Classification reasoning displayed on achievement detail page
- Manual override option: "Add to resume anyway" / "Skip resume update"

**US-004**
As a Pro user, I want to publish my LinkedIn post directly from the app so that I do not have to copy and paste between tools.

**Acceptance criteria:**
- "Publish to LinkedIn" button visible only when LinkedIn is connected and user is Pro
- On click: posts via LinkedIn API, shows confirmation with post URL
- On failure: shows error with retry option

**US-005**
As a user with a Python/FastAPI project on GitHub, I want the app to detect my project type and deploy it to the right platform automatically so that I do not have to configure anything manually.

**Acceptance criteria:**
- System reads repo, detects Python project
- Shows user: "Detected: Python/FastAPI → Deploying to Render (free)"
- After deploy: shows live Render URL

### Resume

**US-006**
As a user without a resume, I want to build one from scratch using a guided form so that I have a professional starting point even if I've never created a resume before.

**US-007**
As a user, I want to see exactly what was changed in my resume after an achievement update so that I can accept or reject the change confidently.

**US-008**
As a Pro user, I want to upload my own resume template so that my resume matches the format expected by my industry or company.

### Portfolio

**US-009**
As a user, I want the app to automatically create and deploy a portfolio site from my GitHub projects without me writing any configuration so that I have a live portfolio URL to share within minutes.

**US-010**
As a user with a Docker-based project, I want my container to be deployed to Railway automatically so that full-stack projects are represented in my portfolio, not just static sites.

### Settings & Payments

**US-011**
As a user, I want to connect my LinkedIn account once and have all future posts publish automatically so that I never have to copy-paste between apps.

**US-012**
As a free user hitting the monthly limit, I want a clear upgrade prompt with pricing so that I can upgrade immediately and continue without losing my work.

---

## 10. Technical Architecture

### 10.1 Overview

Career Autopilot is a monolithic Next.js 14 application using the App Router pattern, deployed on Vercel's serverless infrastructure. All backend logic runs as serverless API routes. Long-running AI tasks are offloaded to Upstash QStash for background processing.

### 10.2 Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Frontend | Next.js 14 (App Router), TypeScript | SSR, file-based routing, API co-location |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, accessible components |
| Authentication | Clerk | OAuth, token management, webhooks |
| Database | Neon (Serverless Postgres) | Serverless-compatible, free tier |
| ORM | Drizzle ORM | Lightweight, TypeScript-native, fast cold starts |
| Cache | Upstash Redis | Serverless-compatible, free tier |
| Queue | Upstash QStash | HTTP-based background jobs, no worker process |
| File Storage | Supabase Storage | Free 1GB, no card required |
| Email | Resend + React Email | 3,000 emails/month free |
| AI — Primary | Anthropic Claude (claude-sonnet-4-6) | Best-in-class reasoning |
| AI — Fallback | xAI Grok (grok-3-mini via OpenAI SDK) | $25 free credits/month |
| PDF Generation | @react-pdf/renderer | Client/server-side, no Puppeteer needed |
| Payments | Razorpay | India-first, 2% fee, no monthly cost |
| Hosting | Vercel | Free tier, global CDN, preview deploys |
| Error Tracking | Sentry | 5,000 errors/month free |

### 10.3 Architecture Decisions

**Serverless over dedicated server:** Vercel serverless functions eliminate infrastructure management and scale automatically. The tradeoff is a 10-second timeout on the free plan (60 seconds on Pro). This is handled by offloading AI pipeline to QStash.

**QStash for background jobs:** Instead of a Redis queue with a worker process (which requires a persistent server), QStash delivers HTTP requests to API endpoints on a delay. This is 100% serverless and aligns with Vercel's architecture.

**Drizzle over Prisma:** Prisma's query engine adds significant cold-start overhead on serverless functions. Drizzle is lightweight and generates plain SQL, making it faster for serverless use cases.

**AI fallback chain:** Primary Claude API call. On 429 (rate limit), 402 (credits exhausted), or 529 (overloaded) errors, the system automatically falls back to xAI Grok. Errors are logged but not surfaced to the user.

### 10.4 Data Flow

```
User submits achievement
    → POST /api/achievement (validates, creates DB record, returns achievementId)
    → Pushes job to QStash
    → Frontend polls GET /api/achievement/{id}/status every 3 seconds

QStash delivers job to POST /api/webhooks/qstash
    → Fetches user resume from DB
    → Calls Claude: classifyAchievement()
    → Updates achievement record with scores
    → Calls Claude: draftLinkedInPost()
    → Creates posts record (status: draft)
    → If resumeWorthy: calls Claude: generateResumeBullet()
    → Creates resumeVersions record
    → If portfolioWorthy: calls GitHub API, triggers deploy
    → Updates achievement status: complete
    → Sends completion email via Resend

Frontend poll detects status: complete
    → Updates progress bar to 100%
    → Shows links to review post and resume
```

### 10.5 Repository Structure

```
career-autopilot/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         (landing page)
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                   (sidebar + auth guard)
│   │   ├── dashboard/page.tsx
│   │   ├── achievement/new/page.tsx
│   │   ├── post/[id]/review/page.tsx
│   │   ├── resume/page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── coach/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── achievement/route.ts
│       ├── achievement/[id]/status/route.ts
│       ├── post/[id]/publish/route.ts
│       ├── resume/generate/route.ts
│       ├── resume/[id]/download/route.ts
│       ├── portfolio/deploy/route.ts
│       ├── skill-gap/route.ts
│       ├── coach/chat/route.ts
│       ├── upload/route.ts
│       ├── payments/create-order/route.ts
│       ├── payments/verify/route.ts
│       └── webhooks/
│           ├── clerk/route.ts
│           ├── razorpay/route.ts
│           └── qstash/route.ts
├── components/
│   ├── ui/                              (shadcn components)
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   ├── achievement/
│   │   ├── achievement-form.tsx
│   │   └── progress-tracker.tsx
│   ├── post/
│   │   ├── post-review-card.tsx
│   │   └── media-uploader.tsx
│   ├── resume/
│   │   └── resume-preview.tsx
│   └── portfolio/
│       └── portfolio-config.tsx
├── lib/
│   ├── ai/
│   │   ├── client.ts                   (unified AI caller with fallback)
│   │   ├── prompts.ts                  (all system prompts)
│   │   ├── classify.ts
│   │   ├── draft-post.ts
│   │   ├── resume-diff.ts
│   │   ├── brand-voice.ts
│   │   ├── skill-gap.ts
│   │   └── career-coach.ts
│   ├── github/client.ts
│   ├── linkedin/client.ts
│   ├── resume/
│   │   ├── builder.ts
│   │   └── templates/
│   │       ├── classic.tsx
│   │       └── modern.tsx
│   ├── portfolio/
│   │   ├── deploy.ts
│   │   ├── detect.ts
│   │   └── platforms/
│   │       ├── github-pages.ts
│   │       ├── vercel.ts
│   │       ├── netlify.ts
│   │       ├── render.ts
│   │       └── railway.ts
│   ├── storage/client.ts               (Supabase Storage)
│   ├── email/templates.tsx
│   ├── queue/qstash.ts
│   ├── payments/razorpay.ts
│   ├── get-user.ts
│   ├── env.ts                          (validated env vars)
│   └── utils.ts
├── db/
│   ├── index.ts
│   ├── schema.ts
│   └── migrations/
├── middleware.ts
├── drizzle.config.ts
└── next.config.ts
```

---

## 11. Database Schema

### 11.1 Tables

#### users

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | Internal user ID |
| clerk_id | text | UNIQUE NOT NULL | Clerk's user ID |
| email | text | NOT NULL | User's email |
| plan | enum(free, pro, team) | DEFAULT free | Current plan |
| voice_profile | jsonb | nullable | Learned writing style |
| created_at | timestamp | DEFAULT now() | Account creation time |

#### achievements

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Achievement ID |
| user_id | uuid | FK → users.id ON DELETE CASCADE | Owner |
| raw_input | text | NOT NULL | Original user text |
| classified_resume_worthy | boolean | nullable | Classification result |
| classified_portfolio_worthy | boolean | nullable | Classification result |
| resume_score | integer | nullable, 1–10 | Resume classification score |
| portfolio_score | integer | nullable, 1–10 | Portfolio classification score |
| achievement_type | text | nullable | certification, project, etc. |
| reasoning | text | nullable | AI classification reasoning |
| resume_bullet | text | nullable | Generated resume bullet |
| resume_section | text | nullable | Target section for bullet |
| status | enum(processing, classified, complete, failed) | DEFAULT processing | Pipeline status |
| created_at | timestamp | DEFAULT now() | Submission time |

#### posts

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Post ID |
| achievement_id | uuid | FK → achievements.id ON DELETE CASCADE | Source achievement |
| platform | enum(linkedin, x) | NOT NULL | Target platform |
| draft_text | text | NOT NULL | AI-generated draft |
| hashtags | text[] | DEFAULT '{}' | Suggested hashtags |
| media_urls | text[] | DEFAULT '{}' | Attached media |
| media_prompt | text | nullable | AI's media suggestion |
| status | enum(draft, approved, published, failed) | DEFAULT draft | Post status |
| published_url | text | nullable | Live post URL after publish |
| error_message | text | nullable | Failure reason if failed |
| published_at | timestamp | nullable | Publish timestamp |
| created_at | timestamp | DEFAULT now() | Draft creation time |

#### resume_versions

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Version ID |
| user_id | uuid | FK → users.id ON DELETE CASCADE | Owner |
| template_id | text | DEFAULT 'classic' | Template used |
| file_url | text | NOT NULL | Supabase Storage URL |
| raw_text | text | NOT NULL | Extracted resume text (for AI context) |
| is_current | boolean | DEFAULT false | Marks active version |
| changes_summary | text | nullable | Human-readable change description |
| created_at | timestamp | DEFAULT now() | Version creation time |

#### portfolio_config

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Config ID |
| user_id | uuid | FK → users.id ON DELETE CASCADE, UNIQUE | Owner |
| github_repo_url | text | nullable | GitHub repo being deployed |
| github_repo_id | bigint | nullable | GitHub repo ID for API calls |
| deploy_platform | text | nullable | vercel, netlify, render, railway, github-pages |
| deploy_url | text | nullable | Live URL |
| project_type | text | nullable | Detected project type |
| template | text | DEFAULT 'minimal' | Portfolio template used |
| platform_project_id | text | nullable | Platform-specific project ID for re-deploys |
| last_deployed | timestamp | nullable | Most recent deploy timestamp |

#### connected_accounts

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Account ID |
| user_id | uuid | FK → users.id ON DELETE CASCADE | Owner |
| platform | text | NOT NULL | linkedin, github |
| access_token | text | NOT NULL | Encrypted OAuth token |
| refresh_token | text | nullable | For token refresh |
| expires_at | timestamp | nullable | Token expiry |
| platform_user_id | text | nullable | User's ID on the platform |
| platform_username | text | nullable | Display name on platform |

#### subscriptions

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Subscription ID |
| user_id | uuid | FK → users.id ON DELETE CASCADE, UNIQUE | Owner |
| razorpay_sub_id | text | nullable | Razorpay subscription ID |
| razorpay_order_id | text | nullable | Last order ID |
| plan | text | NOT NULL | pro, team |
| billing_cycle | text | NOT NULL | monthly, annual |
| status | text | NOT NULL | active, cancelled, failed |
| current_period_end | timestamp | nullable | When current period ends |
| created_at | timestamp | DEFAULT now() | Subscription start |

#### coach_conversations

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Conversation ID |
| user_id | uuid | FK → users.id ON DELETE CASCADE | Owner |
| messages | jsonb | DEFAULT '[]' | Array of {role, content, timestamp} |
| created_at | timestamp | DEFAULT now() | First message time |
| updated_at | timestamp | DEFAULT now() | Last message time |

---

## 12. API Specification

### 12.1 Achievement Endpoints

#### POST /api/achievement
Submit a new achievement for processing.

**Request body:**
```json
{
  "rawInput": "string (10–2000 chars)"
}
```

**Response 201:**
```json
{
  "achievementId": "uuid",
  "status": "processing"
}
```

**Response 429 (free tier limit):**
```json
{
  "error": "Free tier limit reached",
  "message": "You have used 3/3 achievements this month.",
  "upgradeUrl": "/settings/upgrade"
}
```

#### GET /api/achievement/{id}/status
Poll achievement processing status.

**Response 200:**
```json
{
  "id": "uuid",
  "status": "processing | classified | complete | failed",
  "resumeWorthy": true,
  "portfolioWorthy": false,
  "resumeScore": 8,
  "portfolioScore": 5,
  "reasoning": "string",
  "posts": [
    {
      "id": "uuid",
      "platform": "linkedin",
      "status": "draft",
      "draftText": "string"
    }
  ],
  "resumeUpdated": true,
  "portfolioUpdated": false
}
```

---

### 12.2 Post Endpoints

#### POST /api/post/{id}/publish
Publish a reviewed post to a platform.

**Request body:**
```json
{
  "platform": "linkedin",
  "finalText": "string",
  "hashtags": ["string"],
  "mediaUrl": "string | null"
}
```

**Response 200:**
```json
{
  "success": true,
  "publishedUrl": "https://linkedin.com/posts/...",
  "publishedAt": "ISO8601"
}
```

---

### 12.3 Resume Endpoints

#### POST /api/resume/generate
Generate or regenerate the user's resume PDF.

**Request body:**
```json
{
  "templateId": "classic | modern",
  "data": { ... }
}
```

**Response 200:**
```json
{
  "versionId": "uuid",
  "fileUrl": "string",
  "changesSummary": "string"
}
```

#### GET /api/resume/{id}/download
Stream resume PDF for download or preview.

**Query params:** `?preview=true` opens inline in browser

---

### 12.4 Portfolio Endpoints

#### POST /api/portfolio/deploy
Trigger portfolio deployment.

**Request body:**
```json
{
  "repoOwner": "string",
  "repoName": "string",
  "confirmed": true
}
```

**Response 200:**
```json
{
  "platform": "render",
  "projectType": "python",
  "deployUrl": "https://project.onrender.com",
  "status": "deploying | live"
}
```

---

### 12.5 Webhook Endpoints

All webhook endpoints verify signatures before processing.

| Endpoint | Provider | Events handled |
|---|---|---|
| POST /api/webhooks/clerk | Clerk | user.created, user.updated |
| POST /api/webhooks/razorpay | Razorpay | payment.captured, subscription.halted, payment.failed |
| POST /api/webhooks/qstash | Upstash | Background AI pipeline jobs |

---

## 13. UI & UX Requirements

### 13.1 Design Principles

- **Dark-first design.** Default theme is dark (zinc-950 base). Light mode available in settings.
- **Distraction-free flows.** Key user actions (New Achievement, Post Review) are full-screen focused pages with no sidebar.
- **Progressive disclosure.** Show results as they arrive, not after full completion. Each pipeline step updates in real time.
- **Never crash.** Every page must have error boundaries and fallback UI. A loading skeleton is always preferred over a blank page.
- **Mobile-first responsive.** Dashboard must be fully usable on a 375px mobile screen. Primary action buttons are fixed to the bottom on mobile.

### 13.2 Page-by-Page Requirements

**Landing Page**
Must include: hero with clear value proposition in one line, animated demo (CSS only, no video required at launch), feature sections, pricing cards, FAQ accordion, footer. No stock photos. Typography-led design.

**New Achievement Page**
Single, large textarea centred on screen. Character counter. Tip card. Submit button full-width at bottom. On submit: animated multi-step progress bar replaces the form. Steps update in real time.

**Post Review Page**
Render a LinkedIn-style card preview of the post. Editable textarea synced with preview. Hashtag pills (removable). Media upload drag-and-drop zone. Two actions: Copy to clipboard (all users) and Publish to LinkedIn (Pro only). Platform switcher tabs (LinkedIn | X).

**Resume Page**
Split view: left column (30%) shows version history list; right column (70%) shows resume preview. Top bar: Download PDF, Compare versions (diff), Upload template (Pro). Empty state shows two CTAs clearly.

**Portfolio Page**
Three-step onboarding wizard for new users: Connect GitHub → Select repo (with type badges) → Confirm and deploy. After setup: shows live URL, project list from GitHub, and deploy history.

**Settings Page**
Sections: Connected Accounts (LinkedIn, GitHub), Plan & Billing (current plan, upgrade CTA, billing history), Preferences (theme, email notifications), Danger Zone (delete account).

### 13.3 Component Standards

- All buttons use shadcn/ui Button component with consistent sizing
- All form inputs use shadcn/ui Input or Textarea
- Loading states use shadcn/ui Skeleton — never a raw spinner on a blank page
- Toast notifications for success/error feedback on every user action
- All data tables support empty states with illustrated empty state messages

---

## 14. Integration Requirements

### 14.1 LinkedIn Integration

- **OAuth scopes required:** openid, profile, email, w_member_social
- **Token storage:** Encrypted in `connected_accounts` table using AES-256
- **Posting endpoint:** LinkedIn UGC Posts API v2 (`/v2/ugcPosts`)
- **Image upload:** LinkedIn Assets API for media attachment before posting
- **Rate limits:** LinkedIn allows 100 requests per day per user — well within expected usage
- **Fallback:** If LinkedIn API is unavailable, degrade gracefully to copy-paste flow

### 14.2 GitHub Integration

- **OAuth scopes required:** read:user, repo, pages
- **Webhook (optional v1.5):** `push` event to auto-detect new projects
- **Pages API:** Enable GitHub Pages via PUT /repos/{owner}/{repo}/pages
- **Contents API:** Read file structure for project type detection
- **Commits API:** Push portfolio config updates to trigger redeploys

### 14.3 Anthropic Claude API

- **Model:** claude-sonnet-4-6
- **Usage:** Classification, post drafting, resume diff, brand voice, skill gap, career coaching
- **Error handling:** Retry on 429/529 with exponential backoff (max 3 attempts); fall through to xAI on 402

### 14.4 xAI Grok API (Fallback)

- **SDK:** openai (OpenAI-compatible endpoint)
- **Base URL:** https://api.x.ai/v1
- **Model:** grok-3-mini
- **Usage:** Identical prompts as Anthropic — activated only on Anthropic failure

### 14.5 Deployment Platforms

| Platform | API base URL | Auth method | Free tier |
|---|---|---|---|
| Vercel | https://api.vercel.com | Bearer token | Hobby plan |
| Netlify | https://api.netlify.com/api/v1 | Bearer token | Free tier |
| Render | https://api.render.com/v1 | Bearer token | Free tier (sleeps) |
| Railway | https://backboard.railway.app/graphql/v2 | Bearer token | $5/month credits |
| GitHub Pages | https://api.github.com | OAuth token | Free |

### 14.6 Razorpay

- **Checkout flow:** Server creates order → Client opens Razorpay modal → On success, client calls /api/payments/verify → Server verifies signature → Updates user plan
- **Webhook:** payment.captured triggers plan upgrade; subscription.halted triggers downgrade
- **Signature verification:** HMAC SHA-256 using Razorpay webhook secret

---

## 15. Non-Functional Requirements

### 15.1 Performance

| Requirement | Target |
|---|---|
| Dashboard initial load | < 2 seconds (LCP) |
| Achievement submission response | < 500ms (returns immediately, processing is async) |
| AI pipeline completion | < 30 seconds for 95th percentile |
| Portfolio deploy trigger | < 5 seconds to initiate (actual deploy is platform-dependent) |
| Resume PDF generation | < 10 seconds |
| API error rate | < 1% of requests |

### 15.2 Scalability

- Serverless architecture scales horizontally automatically via Vercel
- Neon Postgres auto-scales compute with connection pooling via Neon's built-in pooler
- QStash handles up to 500 background jobs/day on free tier; scales linearly on paid tiers
- No persistent server processes — every component scales independently

### 15.3 Reliability

- Vercel provides 99.99% uptime SLA on Pro plan
- Neon provides 99.9% uptime
- All external API calls (LinkedIn, GitHub, Claude) have retry logic with exponential backoff
- Failed jobs are retried up to 3 times by QStash before marking as failed
- All user data is preserved even if pipeline steps fail

### 15.4 Browser Support

- Chrome 110+, Firefox 110+, Safari 15+, Edge 110+
- Mobile: iOS Safari 15+, Chrome Android 110+
- No Internet Explorer support

---

## 16. Security & Privacy

### 16.1 Authentication Security

- All authentication handled by Clerk — no custom password storage
- JWT validation on every API request via Clerk's server SDK
- Clerk webhook signatures verified using HMAC before processing
- Sessions expire after 7 days of inactivity

### 16.2 Data Security

- OAuth access tokens encrypted at rest using AES-256 before storing in DB
- All database connections use SSL/TLS (enforced by Neon)
- Environment variables never exposed to client — all secrets server-side only
- Supabase Storage files are private by default; resume PDFs served via signed URLs (1-hour expiry)

### 16.3 API Security

- All API routes validate authentication before processing
- Rate limiting enforced via Upstash Redis: 10 requests/10 seconds per IP for general routes, 5 requests/minute per user for achievement submission
- Input validation using Zod on all API request bodies — no raw user data passed to SQL or AI
- SQL injection impossible via Drizzle's parameterized queries
- XSS prevention via Next.js's built-in output encoding

### 16.4 Security Headers

Applied via `next.config.ts`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — restrictive policy allowing only necessary origins

### 16.5 Privacy

- Users can delete their account and all associated data from Settings (Danger Zone)
- No user data sold to third parties
- Resume and portfolio content not used for AI training
- Post analytics data retained for 12 months then auto-purged
- GDPR-compliant data export available on request (via support email in v1)

---

## 17. Release Strategy

### 17.1 Phase 1 — Private Beta (Weeks 1–4)

**Goal:** Validate core flow end-to-end with 20–30 users.

**Features included:**
- Achievement text input
- AI classification and post drafting (LinkedIn only, copy-paste)
- Resume update (auto-generated bullet)
- Basic portfolio (GitHub Pages static only)
- Manual user creation (no public sign-up)

**Success criteria:** 15+ users complete the full pipeline at least once. Average AI draft quality rated ≥ 3.5/5 by testers.

### 17.2 Phase 2 — Public Beta (Weeks 5–8)

**Goal:** Open sign-up, validate freemium, first paying users.

**Features added:**
- Public sign-up via Clerk
- Free tier limits enforced
- Razorpay Pro plan checkout
- Portfolio deployment for all project types
- X/Twitter copy-paste
- Email notifications

**Success criteria:** 100+ registered users, 5+ paying Pro subscribers, < 20% week-1 churn.

### 17.3 Phase 3 — Growth (Weeks 9–16)

**Goal:** Activate virality and expand use cases.

**Features added:**
- LinkedIn direct publish (OAuth)
- Brand voice learning
- Achievement timeline (public shareable page)
- Skill gap analysis
- Career coach chat
- Custom domain for portfolio
- Instagram carousel export
- Cover letter generator

**Success criteria:** 500+ registered users, ₹25,000 MRR, 5% free-to-Pro conversion.

### 17.4 Phase 4 — Team & Institutional (Month 5+)

**Goal:** First B2B revenue, team tier launch.

**Features added:**
- Team plan and admin dashboard
- Cohort management for placement officers
- Bulk student onboarding
- Aggregated team analytics

**Success criteria:** 2 signed institutional deals, ₹50,000+ MRR.

---

## 18. Business Model & Monetization

### 18.1 Revenue Streams

**Stream 1 — Individual Pro Subscription (primary)**
₹499/month or ₹3,999/year per user. Target: working professionals and active freelancers.

**Stream 2 — Team Plan (secondary, higher LTV)**
₹299/user/month, minimum 5 users. Target: placement cells, bootcamps, corporate L&D departments. Average deal size: ₹1,500–15,000/month.

**Stream 3 — Recruiter Discovery (future, v2)**
Recruiters pay ₹2,000–5,000/month to search the user database by skill, certification, and location. This is passive income once the user base is large enough.

### 18.2 Unit Economics

| Metric | Free user | Pro user |
|---|---|---|
| Monthly AI cost | ~₹2 (3 updates × ₹0.5–1) | ~₹15–30 (unlimited, avg 10 updates) |
| Infrastructure cost | ~₹0 (within free tiers) | ~₹2 (proportional share of paid tiers) |
| Revenue | ₹0 | ₹499 |
| Gross margin | Negative | ~92% |
| Payback period | Never | Immediate |

**Blended gross margin target at 500 users (10% paid):** ~85%

### 18.3 Growth Strategy

- **SEO:** Blog posts targeting "how to update LinkedIn after certification", "resume update after project", "developer portfolio builder". Long-tail keywords with high buyer intent.
- **Virality:** Every published post includes "Posted via Career Autopilot" in the first comment (opt-out available). Every portfolio includes "Built with Career Autopilot" in the footer (Pro removes this).
- **Partnership:** Approach Coursera, Udemy, and NPTEL to integrate as a "share achievement" option on their completion pages.
- **College outreach:** Target placement coordinators directly. One coordinator = 100–500 students.
- **Community:** LinkedIn presence posting examples of Career Autopilot-generated content with outcomes (reach, profile views, etc.).

---

## 19. Open Source Strategy

### 19.1 What is Open Sourced

| Component | License | Repository |
|---|---|---|
| Resume templates (Classic, Modern) | MIT | career-autopilot/resume-templates |
| Portfolio templates (Minimal, Developer, Creative) | MIT | career-autopilot/portfolio-templates |
| Achievement classification prompt structure | MIT | career-autopilot/ai-prompts |
| Setup and onboarding documentation | CC-BY | career-autopilot/docs |

### 19.2 What Stays Closed

- Core application source code
- Specific AI prompt engineering and tuning
- Classification scoring algorithm internals
- LinkedIn and GitHub integration layer
- Business logic (freemium gating, rate limiting)
- Payment integration

### 19.3 Rationale

Open sourcing templates drives developer trust and organic GitHub stars. Every developer who forks a template and uses it sees the Career Autopilot brand and is a potential Pro subscriber. The core application remains closed to prevent direct competitors from instantly replicating the full product.

### 19.4 Future Consideration

After reaching 2,000+ active users and establishing product-market fit, consider open sourcing the full application under AGPL-3.0. AGPL requires any company using the code to open-source their modifications, protecting commercial interests while building a developer community.

---

## 20. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LinkedIn API restricts automated posting | High | High | Degrade to copy-paste gracefully. Apply for MDP access early. |
| Claude API pricing increases | Medium | Medium | AI fallback chain to xAI. Cache results aggressively. |
| Vercel changes free tier limits | Low | High | Architecture can migrate to Railway or Fly.io. Serverless-agnostic code. |
| Low free-to-Pro conversion | Medium | High | Improve onboarding, add more Pro-exclusive high-value features faster. |
| Competitor with same idea launches | Medium | Medium | Speed of execution and quality of AI output is the moat. |
| AI generates low-quality posts | Medium | High | Human review step is mandatory. Collect feedback per post to improve prompts. |
| Render/Railway free tier abuse | Low | Low | Only deploy on behalf of authenticated users. Rate-limit deploy API calls. |
| Data breach | Low | Very High | Encrypt tokens, regular security audits, Clerk handles auth data. |
| Razorpay account flagged | Low | High | Keep clean transaction records. Onboard with individual PAN initially. |
| GitHub Pages / Vercel deploy limits | Low | Medium | Route to alternative platforms. Never depend on a single deploy target. |

---

## 21. Future Roadmap

### v2.0 — Intelligence Layer (Month 6–12)

- Voice achievement input via Web Speech API
- Browser extension for Chrome and Firefox (auto-detect Coursera, Udemy, LinkedIn Learning completions)
- GitHub webhook auto-detection (new repo push = achievement suggestion)
- Certificate image scan with OCR (Tesseract.js, client-side)
- Recruiter discovery mode (opt-in profile visibility for recruiters)
- Post engagement analytics (impressions, reactions, comments via LinkedIn API)
- Salary benchmarking (compare skills against market data from public sources)
- Profile strength score (0–100 gamified completeness metric)

### v3.0 — Social & Community (Month 12–18)

- Public achievement timeline (shareable profile URL)
- Community feed (opt-in, see achievements from your network)
- Leaderboard for cohorts (for institutional accounts)
- Peer endorsements on achievements
- Achievement badge system (milestone rewards)
- Monthly career digest newsletter per user

### v4.0 — Platform & API (Month 18–24)

- Public REST API for third-party integrations
- Zapier and n8n connectors
- Notion integration (pull achievements from Notion databases)
- Slack bot (log achievements directly from Slack)
- iOS and Android native apps (React Native)
- X/Twitter direct publish (when revenue supports API cost)
- Instagram carousel direct publish via Meta Graph API

---

## 22. Glossary

| Term | Definition |
|---|---|
| Achievement | Any career milestone a user logs: certification, project, award, job change, publication, etc. |
| Classification | The AI process of scoring an achievement for resume-worthiness and portfolio-worthiness |
| Resume-worthy | An achievement scoring ≥ 7/10 on the resume classification scale |
| Portfolio-worthy | An achievement scoring ≥ 6/10 on the portfolio classification scale |
| Pipeline | The sequence of background tasks triggered by an achievement submission: classify → draft → resume update → portfolio update |
| QStash | Upstash's HTTP-based message queue used for background job processing |
| Brand voice | A learned JSON profile of the user's writing style, built from their approved post history |
| Deploy platform | One of: GitHub Pages, Vercel, Netlify, Render, or Railway — selected automatically based on project type |
| Project type detection | Reading a GitHub repository's file structure to determine the framework and language |
| Pro | The paid subscription plan at ₹499/month unlocking unlimited usage and direct publishing |
| Team | The institutional subscription plan at ₹299/user/month for 5+ users |
| Resume version | A point-in-time snapshot of the user's resume, preserved after every AI update |
| Fallback chain | The system of trying Anthropic Claude first, then falling back to xAI Grok on failure |
| Voice profile | A JSON object describing the user's tone, length preference, emoji usage, and signature phrases, used to personalise AI post drafts |
| MRR | Monthly Recurring Revenue — the primary business health metric |
| MAU | Monthly Active Users — users who log at least one achievement or publish at least one post in a calendar month |

---

*End of Document*

*Career Autopilot PRD v1.0 — For internal use only*