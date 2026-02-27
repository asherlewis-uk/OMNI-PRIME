// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR - Navigation Sidebar Component
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Bot,
  Network,
  Wrench,
  Database,
  Settings,
  Sparkles,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { id: "agents", label: "Agents", href: "/agents", icon: Bot },
  { id: "swarm", label: "Swarm", href: "/swarm", icon: Network },
  { id: "tools", label: "Tools", href: "/tools", icon: Wrench },
  { id: "knowledge", label: "Knowledge", href: "/knowledge", icon: Database },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-white">OMNI</span>
      </Link>

      {/* Navigation */}
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                "hover:bg-white/5",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              <Icon className={cn(
                "h-5 w-5",
                isActive ? "text-violet-400" : "text-white/40"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
