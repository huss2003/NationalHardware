import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const reduce = useReducedMotion();
  const initial = reduce ? false : { opacity: 0, y: 8 };
  const animate = reduce ? undefined : { opacity: 1, y: 0 };
  return (
    <header className="page-header">
      <div className="flex flex-wrap items-end justify-between gap-4 px-8 pt-10 pb-6 max-w-[1400px] mx-auto w-full">
        <motion.div
          className="space-y-1.5"
          initial={initial}
          animate={animate}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.022em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
          )}
        </motion.div>
        {actions && (
          <motion.div
            className="flex gap-2 items-center"
            initial={initial}
            animate={animate}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          >
            {actions}
          </motion.div>
        )}
      </div>
    </header>
  );
}
