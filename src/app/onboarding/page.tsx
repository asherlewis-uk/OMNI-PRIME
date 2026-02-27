// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING PAGE - Genesis Flow Entry
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GenesisWizard } from "@/components/onboarding/GenesisWizard";
import { SafeAreaProvider } from "@/components/layout/SafeAreaProvider";

export default function OnboardingPage() {
  const router = useRouter();

  React.useEffect(() => {
    // Check if already onboarded
    const isGenesisComplete = localStorage.getItem("omni-genesis-complete") === "true";
    if (isGenesisComplete) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <SafeAreaProvider>
      <GenesisWizard />
    </SafeAreaProvider>
  );
}
