"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Menu,
  X,
  Rocket,
  LayoutDashboard,
  Plus,
  FileText,
  Globe,
  MessageSquare,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Friendly page titles keyed by route prefix
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/achievement/new": "Log Achievement",
  "/achievement": "Achievements",
  "/resume": "Resume",
  "/portfolio": "Portfolio",
  "/coach": "Career Coach",
  "/settings": "Settings",
};

const mobileNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Achievement", href: "/achievement/new", icon: Plus, accent: true },
  { label: "Resume", href: "/resume", icon: FileText },
  { label: "Portfolio", href: "/portfolio", icon: Globe },
  { label: "Career Coach", href: "/coach", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings2 },
];

function getPageTitle(pathname: string): string {
  // Exact match first, then prefix match (longest wins)
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES)
    .filter((key) => key !== "/dashboard" && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLES[match] : "Dashboard";
}

export function Header() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);

  return (
    <>
      {/* ── Top header bar ─────────────────────────────────────── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-sm">
        {/* Left: hamburger (mobile) + page title */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
            {pageTitle}
          </h1>
        </div>

        {/* Right: user button (desktop) */}
        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <UserButton
              appearance={{ elements: { avatarBox: "w-7 h-7" } }}
            />
          </div>
        </div>
      </header>

      {/* ── Mobile slide-in drawer ──────────────────────────────── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-300 ease-in-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Rocket size={16} className="text-emerald-400" />
            <span className="font-bold text-sm text-white">Career Autopilot</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            if (item.accent) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500 text-zinc-950">
                    <Icon size={14} strokeWidth={2.5} />
                  </span>
                  {item.label}
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800 text-emerald-400"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={cn(
                    "shrink-0",
                    isActive ? "text-emerald-400" : "text-zinc-500"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
