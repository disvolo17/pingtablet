import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Optional left icon */
  icon?: ReactNode;
  /** Disable the button */
  disabled?: boolean;
  /** Optional small caption shown above the button */
  caption?: string;
  /** Visual variant of the action */
  variant?: "default" | "outline" | "secondary";
  /** Extra classes for the wrapper */
  className?: string;
};

/**
 * Floating, mobile-only CTA pinned just above the bottom dock.
 * Honors iOS safe-area-inset-bottom and never appears on md+ where space is roomy.
 *
 * Layout note: the global mobile dock sits at the very bottom (~64px tall incl. padding).
 * This CTA sits at `bottom: dockHeight + safe-area`.
 */
export default function MobileStickyCTA({
  label,
  onClick,
  icon,
  disabled,
  caption,
  variant = "default",
  className,
}: Props) {
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        // Mobile-only — hidden on tablet+ where the page CTA is always visible.
        "md:hidden fixed inset-x-0 z-40 px-3 pointer-events-none",
        // Position above the floating dock with safe-area awareness.
        // Dock is ~64px tall + 12px gap. We add safe-area-inset-bottom on top.
        "[bottom:calc(env(safe-area-inset-bottom)+76px)]",
        className,
      )}
    >
      {/* Soft fade to background so content scrolls cleanly under the CTA */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-6 h-10 pointer-events-none bg-gradient-to-b from-transparent to-background/85"
      />
      <div className="relative pointer-events-auto mx-auto max-w-md">
        {caption && (
          <div className="mb-1.5 text-center text-[11px] text-subtle">{caption}</div>
        )}
        <Button
          size="lg"
          variant={variant}
          onClick={onClick}
          disabled={disabled}
          className="w-full rounded-full shadow-[0_14px_40px_-12px_hsl(var(--ink)/0.45)]"
        >
          {icon}
          {label}
        </Button>
      </div>
    </motion.div>
  );
}
