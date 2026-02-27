// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE - Router: Redirects to Onboarding or Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Check if genesis onboarding is complete
    const isGenesisComplete = localStorage.getItem("omni-genesis-complete") === "true";
    const hasProfile = localStorage.getItem("omni-profile-id");

    if (isGenesisComplete && hasProfile) {
      // User has completed onboarding, go to dashboard
      router.replace("/dashboard");
    } else {
      // New user or incomplete onboarding, go to onboarding
      router.replace("/onboarding");
    }

    setIsLoading(false);
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        <p className="text-sm text-white/60">Loading OMNI-PRIME...</p>
      </div>
    </div>
  );
}
