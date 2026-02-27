"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { UseCaseType } from "@/types/genesis";

interface UseCaseOption {
  id: UseCaseType;
  label: string;
  description: string;
  icon: string;
}

const USE_CASES: UseCaseOption[] = [
  { id: "marketer", label: "Marketing", description: "Content creation, campaigns, and market research", icon: "📢" },
  { id: "developer", label: "Developer", description: "Code review, debugging, and architecture", icon: "💻" },
  { id: "founder", label: "Founder", description: "Pitch decks, strategy, and fundraising", icon: "🚀" },
  { id: "writer", label: "Writer", description: "Editing, ideation, and content refinement", icon: "✍️" },
  { id: "researcher", label: "Researcher", description: "Literature review and data synthesis", icon: "🔬" },
  { id: "designer", label: "Designer", description: "Design feedback and UX consultation", icon: "🎨" },
  { id: "student", label: "Student", description: "Learning assistance and homework help", icon: "🎓" },
  { id: "custom", label: "Custom", description: "Build your own agent configuration", icon: "⚙️" },
];

interface UseCaseSelectorProps {
  value?: UseCaseType;
  onChange: (useCase: UseCaseType) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function UseCaseSelector({ value, onChange }: UseCaseSelectorProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {USE_CASES.map((useCase) => {
        const isSelected = value === useCase.id;
        return (
          <motion.button
            key={useCase.id}
            variants={itemVariants}
            onClick={() => onChange(useCase.id)}
            className={cn(
              "relative flex flex-col items-start p-6 rounded-2xl",
              "bg-white/5 border border-white/10",
              "transition-all duration-200 ease-out",
              "hover:bg-white/10 hover:border-white/20 hover:-translate-y-1",
              "active:scale-[0.98]",
              "cursor-pointer text-left",
              isSelected && [
                "bg-indigo-500/10 border-indigo-500/50",
                "hover:bg-indigo-500/15 hover:border-indigo-500/60",
              ]
            )}
          >
            <span className="text-4xl mb-4 block">{useCase.icon}</span>
            <h3 className={cn("text-lg font-semibold mb-2", isSelected ? "text-white" : "text-slate-200")}>
              {useCase.label}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {useCase.description}
            </p>
            {isSelected && (
              <motion.div
                layoutId="usecase-selection"
                className="absolute top-4 right-4"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
