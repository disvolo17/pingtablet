// Smooth expandable section with chevron + premium chrome.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

type Props = {
  title: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
};

export default function ExpandableSection({ title, eyebrow, icon, defaultOpen = false, rightSlot, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pt-card mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl hairline bg-paper">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">{eyebrow}</div>}
            <div className="font-display text-base md:text-lg font-bold tracking-tight truncate">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 320, damping: 24 }}>
            <ChevronDown className="h-4 w-4 text-subtle" />
          </motion.span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
