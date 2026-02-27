// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE - Main Application Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { MobileShell } from "@/components/layout/MobileShell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, MessageSquare, Plus, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  // Check authentication
  React.useEffect(() => {
    const isGenesisComplete = localStorage.getItem("omni-genesis-complete") === "true";
    if (!isGenesisComplete) {
      router.replace("/onboarding");
    }
  }, [router]);

  const dashboardContent = (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome to OMNI-PRIME</h1>
          <p className="text-white/60">Your sovereign AI workspace</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-500 min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <Card className="border-white/5 bg-gradient-to-br from-violet-500/10 to-transparent">
        <CardHeader>
          <CardTitle className="text-white">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-white/60">
            Your OMNI-PRIME workspace is ready. Here&apos;s what you can do:
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 text-xs">1</span>
              Create your first AI agent from the Agents page
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 text-xs">2</span>
              Start a conversation with your agents
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 text-xs">3</span>
              Connect external tools via MCP servers
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  // Mobile view
  if (isMobile) {
    return (
      <MobileShell
        defaultTab={0}
        children={[
          // Dashboard Tab
          <div key="dashboard" className="p-4">
            {dashboardContent}
          </div>,
          // Agents Tab (placeholder)
          <div key="agents" className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Agents</h2>
            <p className="text-white/60">Your agents will appear here</p>
          </div>,
          // Tools Tab (placeholder)
          <div key="tools" className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Tools</h2>
            <p className="text-white/60">Connected tools will appear here</p>
          </div>,
          // Settings Tab (placeholder)
          <div key="settings" className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
            <p className="text-white/60">Configure your workspace</p>
          </div>,
        ]}
      />
    );
  }

  // Desktop view
  return (
    <DesktopShell sidebarContent={null} contextPanel={null}>
      {dashboardContent}
    </DesktopShell>
  );
}
