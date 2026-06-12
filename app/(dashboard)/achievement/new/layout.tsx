/**
 * Focused layout for the achievement submission flow.
 * Overrides the parent (dashboard) layout by providing a clean full-screen
 * canvas — no sidebar, no header chrome — so the writer can focus.
 *
 * Next.js app router: nested layouts override per-segment, so placing
 * a layout.tsx here replaces the dashboard layout for /achievement/new.
 * The root layout (ClerkProvider, fonts) still applies.
 */
export default function AchievementFocusedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
