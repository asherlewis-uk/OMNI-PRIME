// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE SHELL - Bottom Navigation + Swipeable Views
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { SafeAreaBottom, SafeAreaTop } from "./SafeAreaProvider";
import {
  Home,
  Bot,
  Wrench,
  Settings,
} from "lucide-react";

interface MobileShellProps {
  children: React.ReactNode[];
  defaultTab?: number;
  onTabChange?: (index: number) => void;
}

const TABS = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "settings", label: "Settings", icon: Settings },
];

export function MobileShell({
  children,
  defaultTab = 0,
  onTabChange,
}: MobileShellProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    
  });

  // Sync carousel with tab state
  React.useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setActiveTab(index);
      onTabChange?.(index);
    };

    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onTabChange]);

  // Navigate to tab
  const navigateToTab = (index: number) => {
    emblaApi?.scrollTo(index);
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Top Safe Area */}
      <SafeAreaTop className="bg-black/80 backdrop-blur-xl border-b border-white/5" />

      {/* Main Content - Swipeable Views */}
      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {children.map((child, index) => (
            <div
              key={index}
              className="flex-[0_0_100%] min-w-0 h-full overflow-hidden"
            >
              <div className="h-full overflow-y-auto scrollbar-hide">
                {child}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="shrink-0 bg-black/90 backdrop-blur-xl border-t border-white/5">
        <div className="flex items-center justify-around px-2">
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === index;

            return (
              <button
                key={tab.id}
                onClick={() => navigateToTab(index)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-4 min-h-[56px] min-w-[64px] rounded-lg transition-colors",
                  "active:scale-95",
                  isActive
                    ? "text-violet-400"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                <Icon className={cn(
                  "w-6 h-6 mb-1 transition-all",
                  isActive && "scale-110"
                )} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
        <SafeAreaBottom />
      </nav>
    </div>
  );
}

// CSS for hiding scrollbar
const scrollbarHideStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

// Add styles to document
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = scrollbarHideStyles;
  document.head.appendChild(style);
}
