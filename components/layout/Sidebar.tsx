"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Bell,
  Settings,
  HardHat,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chantiers", href: "/projects", icon: Building2 },
  { label: "Factures", href: "/invoices", icon: FileText },
  { label: "Alertes", href: "/alerts", icon: Bell, badge: true },
  { label: "Réglages", href: "/settings", icon: Settings },
];

interface SidebarProps {
  userEmail: string;
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = userEmail.split("@")[0] ?? userEmail;

  return (
    <>
      {/* ── Desktop sidebar (always visible ≥ lg) ─────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-gray-900 text-white shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 shrink-0">
            <HardHat className="size-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight truncate">
            PresupuestoPro
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, badge }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="inline-flex size-2 rounded-full bg-red-500 ring-2 ring-gray-900" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile + logout */}
        <div className="px-3 pb-4 border-t border-white/10 pt-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 shrink-0 text-xs font-bold text-gray-300 uppercase">
              {displayName.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 leading-none mt-0.5">
                Admin
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar (logo only) ────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-gray-900 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 shrink-0">
            <HardHat className="size-3.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">PresupuestoPro</span>
        </div>
        {/* User initial badge */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 text-xs font-bold text-gray-300 uppercase">
          {displayName.slice(0, 2)}
        </div>
      </div>

      {/* ── Mobile bottom navigation bar ─────────────────────────────── */}
      <MobileBottomNav pathname={pathname} />
    </>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ label, href, icon: Icon, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                isActive ? "text-amber-500" : "text-gray-400"
              )}
            >
              <div className="relative">
                <Icon className="size-5" />
                {badge && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex size-2 rounded-full bg-red-500" />
                )}
              </div>
              <span className={cn("text-[10px] font-medium leading-none", isActive ? "text-amber-500" : "text-gray-400")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* iPhone safe area spacer */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
