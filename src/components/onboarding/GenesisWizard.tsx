"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGenesisStore } from "@/lib/stores/genesisStore";
import { Button } from "@/components/ui/button";
import { UseCaseSelector } from "./UseCaseSelector";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "usecase", title: "Select Your Role", description: "What best describes you?" },
  { id: "objectives", title: "Define Your Goals", description: "What do you want to achieve?" },
  { id: "tools", title: "Choose Your Tools", description: "What capabilities do you need?" },
  { id: "personality", title: "Set Your Style", description: "How should agents communicate?" },
  { id: "generation", title: "Creating Your Agents", description: "Generating your personalized swarm..." },
];

export function GenesisWizard() {
  const router = useRouter();
  const {
    currentStep,
    totalSteps,
    answers,
    isGenerating,
    generationProgress,
    isComplete,
    goToNextStep,
    goToPreviousStep,
    canProceedToNext,
    completeOnboarding,
    setUseCase,
    toggleObjective,
    setSkillLevel,
    setWorkStyle,
    setContentTone,
    toggleToolPreference,
  } = useGenesisStore();

  const [isCompleting, setIsCompleting] = React.useState(false);

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    const result = await completeOnboarding();
    if (result?.success) {
      localStorage.setItem("omni-genesis-complete", "true");
      localStorage.setItem("omni-profile-id", result.profileId);
      router.push("/dashboard");
    }
    setIsCompleting(false);
  };

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-white/5">
        <motion.div
          className="h-full bg-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">OMNI-PRIME</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                {STEPS[currentStep]?.title}
              </h1>
              <span className="text-sm text-slate-500">
                Step {currentStep + 1} of {totalSteps}
              </span>
            </div>
            <p className="mt-2 text-lg text-slate-400">
              {STEPS[currentStep]?.description}
            </p>
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {currentStep === 0 && (
                  <UseCaseSelector value={answers.useCase} onChange={setUseCase} />
                )}

                {currentStep === 1 && (
                  <ObjectivesStep values={answers.objectives ?? []} onToggle={toggleObjective} />
                )}

                {currentStep === 2 && (
                  <ToolsStep values={answers.toolPreferences ?? []} onToggle={toggleToolPreference} />
                )}

                {currentStep === 3 && (
                  <PersonalityStep
                    skillLevel={answers.skillLevel}
                    workStyle={answers.workStyle}
                    contentTone={answers.contentTone}
                    onSkillLevelChange={setSkillLevel}
                    onWorkStyleChange={setWorkStyle}
                    onContentToneChange={setContentTone}
                  />
                )}

                {currentStep === 4 && (
                  <GenerationStep progress={generationProgress} isComplete={isComplete} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-12 pt-6 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={goToPreviousStep}
              disabled={currentStep === 0 || isGenerating}
              className={cn("h-12 px-6 text-slate-400 hover:text-white hover:bg-white/5", currentStep === 0 && "invisible")}
            >
              <ChevronLeft className="mr-2 h-5 w-5" />
              Back
            </Button>

            {currentStep < totalSteps - 1 ? (
              <Button
                onClick={goToNextStep}
                disabled={!canProceedToNext()}
                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
              >
                Continue
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={isGenerating || isCompleting || !isComplete}
                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    Launch OMNI
                    <Sparkles className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import type { SkillLevel, WorkStyle, ContentTone } from "@/types/genesis";

const OBJECTIVES = [
  { id: "content-creation", label: "Content Creation", icon: "✍️" },
  { id: "code-review", label: "Code Review", icon: "🛡️" },
  { id: "market-research", label: "Market Research", icon: "🔍" },
  { id: "email-automation", label: "Email Automation", icon: "📧" },
  { id: "debugging", label: "Debugging", icon: "🐛" },
  { id: "pitch-decks", label: "Pitch Decks", icon: "🎯" },
  { id: "social-media", label: "Social Media", icon: "📱" },
  { id: "architecture", label: "Architecture", icon: "🏗️" },
];

function ObjectivesStep({ values, onToggle }: { values: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {OBJECTIVES.map((obj) => {
        const isSelected = values.includes(obj.id);
        return (
          <button
            key={obj.id}
            onClick={() => onToggle(obj.id)}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl",
              "bg-white/5 border border-white/10",
              "transition-all duration-200",
              "hover:bg-white/10 hover:border-white/20",
              isSelected && ["bg-indigo-500/10 border-indigo-500/50"]
            )}
          >
            <span className="text-2xl">{obj.icon}</span>
            <span className="text-sm font-medium text-slate-200">{obj.label}</span>
            {isSelected && <Check className="ml-auto h-4 w-4 text-indigo-400" />}
          </button>
        );
      })}
    </div>
  );
}

const TOOLS = [
  { id: "web_search", label: "Web Search", icon: "🔍", desc: "Search the internet" },
  { id: "file_system", label: "File System", icon: "📁", desc: "Access local files" },
  { id: "github", label: "GitHub", icon: "🐙", desc: "Manage repositories" },
  { id: "sqlite", label: "SQLite", icon: "🗄️", desc: "Query databases" },
];

function ToolsStep({ values, onToggle }: { values: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {TOOLS.map((tool) => {
        const isSelected = values.includes(tool.id);
        return (
          <button
            key={tool.id}
            onClick={() => onToggle(tool.id)}
            className={cn(
              "flex items-start gap-4 p-5 rounded-xl text-left",
              "bg-white/5 border border-white/10",
              "transition-all duration-200",
              "hover:bg-white/10 hover:border-white/20",
              isSelected && ["bg-indigo-500/10 border-indigo-500/50"]
            )}
          >
            <span className="text-3xl">{tool.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-slate-200">{tool.label}</div>
              <div className="text-sm text-slate-400">{tool.desc}</div>
            </div>
            <div className={cn("w-5 h-5 rounded border flex items-center justify-center", isSelected ? "bg-indigo-500 border-indigo-500" : "border-white/20")}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PersonalityStep({
  skillLevel, workStyle, contentTone,
  onSkillLevelChange, onWorkStyleChange, onContentToneChange,
}: {
  skillLevel?: SkillLevel;
  workStyle?: WorkStyle;
  contentTone?: ContentTone;
  onSkillLevelChange: (v: SkillLevel) => void;
  onWorkStyleChange: (v: WorkStyle) => void;
  onContentToneChange: (v: ContentTone) => void;
}) {
  const renderButtons = (selected: string | undefined, options: string[], onSelect: (v: string) => void) => (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={cn(
            "flex-1 py-3 px-4 rounded-lg text-sm font-medium capitalize",
            "bg-white/5 border border-white/10",
            "transition-all duration-200",
            "hover:bg-white/10 hover:border-white/20",
            selected === opt ? "bg-indigo-500/10 border-indigo-500/50 text-white" : "text-slate-400"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">Skill Level</label>
        {renderButtons(skillLevel, ["beginner", "intermediate", "expert"], (v) => onSkillLevelChange(v as SkillLevel))}
      </div>
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">Work Style</label>
        {renderButtons(workStyle, ["solo", "team", "hybrid"], (v) => onWorkStyleChange(v as WorkStyle))}
      </div>
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">Communication Style</label>
        {renderButtons(contentTone, ["professional", "casual", "technical", "creative"], (v) => onContentToneChange(v as ContentTone))}
      </div>
    </div>
  );
}

function GenerationStep({ progress, isComplete }: { progress: number; isComplete: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full border-4 border-white/5" />
        <svg className="absolute inset-0 w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-indigo-500"
            strokeDasharray={`${progress * 2.89} 289`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {isComplete ? (
            <Check className="w-8 h-8 text-emerald-400" />
          ) : (
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          )}
        </div>
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">
        {isComplete ? "Agents Ready!" : "Generating Your Agents..."}
      </h3>
      <p className="text-slate-400 text-center max-w-md">
        {isComplete ? "Your personalized AI swarm has been created." : `Configuring... ${Math.round(progress)}%`}
      </p>
    </div>
  );
}
