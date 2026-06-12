"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Plus,
  FileText,
  Globe,
  MessageSquare,
  Settings2,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardUser } from "@/app/(dashboard)/layout";

interface SidebarProps {
  user: DashboardUser;
}

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    accent: false,
  },
  {
    label: "New Achievement",
    href: "/achievement/new",
    icon: Plus,
    accent: true, // emerald bg pill
  },
  {
    label: "Resume",
    href: "/resume",
    icon: FileText,
    accent: false,
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    icon: Globe,
    accent: false,
  },
  {
    label: "Career Coach",
    href: "/coach",
    icon: MessageSquare,
    accent: false,
    proGated: true, // show "Pro" badge if user is free
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings2,
    accent: false,
  },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { user: clerkUser } = useUser();

  const isPro = user.plan === "pro" || user.plan === "team";
  const displayName =
    clerkUser?.fullName ??
    clerkUser?.firstName ??
    user.email.split("@")[0];

  return (
    <>
      {/* ── Desktop sidebar (fixed, 240px) ─────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen border-r border-zinc-800/70 bg-zinc-950/90 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-zinc-800/70 shrink-0">
          <span className="text-emerald-400">
            <Rocket size={18} strokeWidth={2.5} />
          </span>
          <span className="font-bold text-white text-sm tracking-tight">
            Career Autopilot
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            if (item.accent) {
              // "New Achievement" — always-emerald pill
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group",
                    "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  )}
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
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-zinc-800 text-emerald-400"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive
                      ? "text-emerald-400"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.proGated && !isPro && (
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                    Pro
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user info + plan badge */}
        <div className="shrink-0 border-t border-zinc-800/70 p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7",
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
            </div>
            <span
              className={cn(
                "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                isPro
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              )}
            >
              {isPro ? "Pro" : "Free"}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/70 flex items-center justify-around px-2 py-2">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150",
                item.accent
                  ? "text-emerald-400"
                  : isActive
                  ? "text-emerald-400"
                  : "text-zinc-500"
              )}
            >
              {item.accent ? (
                <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Icon size={16} strokeWidth={2.5} className="text-zinc-950" />
                </span>
              ) : (
                <Icon size={20} strokeWidth={1.75} />
              )}
              <span className="text-[9px] font-medium leading-none">
                {item.label.split(" ")[0]}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
