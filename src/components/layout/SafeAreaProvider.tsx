// ═══════════════════════════════════════════════════════════════════════════════
// SAFE AREA PROVIDER - Handles iOS/Android Notch and Safe Areas
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SafeAreaContextValue {
  safeAreaTop: number;
  safeAreaBottom: number;
  safeAreaLeft: number;
  safeAreaRight: number;
}

const SafeAreaContext = React.createContext<SafeAreaContextValue>({
  safeAreaTop: 0,
  safeAreaBottom: 0,
  safeAreaLeft: 0,
  safeAreaRight: 0,
});

export const useSafeArea = () => React.useContext(SafeAreaContext);

interface SafeAreaProviderProps {
  children: React.ReactNode;
  className?: string;
}

export function SafeAreaProvider({ children, className }: SafeAreaProviderProps) {
  const [safeArea, setSafeArea] = React.useState<SafeAreaContextValue>({
    safeAreaTop: 0,
    safeAreaBottom: 0,
    safeAreaLeft: 0,
    safeAreaRight: 0,
  });

  React.useEffect(() => {
    // Read CSS environment variables
    const updateSafeArea = () => {
      const styles = getComputedStyle(document.documentElement);
      const top = parseInt(styles.getPropertyValue("--sat") || "0", 10);
      const bottom = parseInt(styles.getPropertyValue("--sab") || "0", 10);
      const left = parseInt(styles.getPropertyValue("--sal") || "0", 10);
      const right = parseInt(styles.getPropertyValue("--sar") || "0", 10);

      setSafeArea({
        safeAreaTop: top || parseInt(styles.getPropertyValue("padding-top") || "0", 10),
        safeAreaBottom: bottom,
        safeAreaLeft: left,
        safeAreaRight: right,
      });
    };

    updateSafeArea();
    window.addEventListener("resize", updateSafeArea);

    return () => window.removeEventListener("resize", updateSafeArea);
  }, []);

  return (
    <SafeAreaContext.Provider value={safeArea}>
      <div
        className={cn("min-h-screen bg-black text-white", className)}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        {children}
      </div>
    </SafeAreaContext.Provider>
  );
}

// Utility components for safe area padding
export function SafeAreaTop({ className }: { className?: string }) {
  const { safeAreaTop } = useSafeArea();
  return (
    <div
      className={cn("w-full shrink-0", className)}
      style={{ height: Math.max(safeAreaTop, 0) }}
    />
  );
}

export function SafeAreaBottom({ className }: { className?: string }) {
  const { safeAreaBottom } = useSafeArea();
  return (
    <div
      className={cn("w-full shrink-0", className)}
      style={{ height: Math.max(safeAreaBottom, 0) }}
    />
  );
}
