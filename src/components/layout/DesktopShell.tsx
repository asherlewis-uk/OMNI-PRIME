// ═══════════════════════════════════════════════════════════════════════════════
// DESKTOP SHELL - 3-Pane Layout (Sidebar | Feed | Context)
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DesktopShellProps {
  children: React.ReactNode;
  sidebarContent?: React.ReactNode;
  contextPanel?: React.ReactNode;
}

export function DesktopShell({
  children,
  sidebarContent,
  contextPanel,
}: DesktopShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-black">
      {/* Left: Sidebar - Fixed 240px width */}
      <aside className="w-60 shrink-0 border-r border-white/5 bg-black/80 backdrop-blur-xl">
        <ScrollArea className="h-full">
          <div className="p-4">
            <Sidebar />
            {sidebarContent}
          </div>
        </ScrollArea>
      </aside>

      {/* Center: Active Feed - Flexible */}
      <main className="flex-1 flex flex-col min-w-0 bg-black">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-3xl mx-auto p-6">
              {children}
            </div>
          </ScrollArea>
        </div>
      </main>

      {/* Right: Agent Context - Fixed 320px width */}
      <aside className="w-80 shrink-0 border-l border-white/5 bg-black/60 backdrop-blur-xl hidden xl:block">
        <ScrollArea className="h-full">
          <div className="p-4">
            {contextPanel ?? <DefaultContextPanel />}
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}

function DefaultContextPanel() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
        Context
      </h3>
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <p className="text-sm text-white/40">
          Select an agent to view context and details here.
        </p>
      </div>
    </div>
  );
}
