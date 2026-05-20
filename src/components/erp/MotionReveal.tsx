import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

type Props = HTMLMotionProps<"div"> & { delay?: number };

/** Lightweight scroll-reveal wrapper. Fades + lifts in once on view. */
export const MotionReveal = forwardRef<HTMLDivElement, Props>(
  ({ delay = 0, children, ...rest }, ref) => {
    const reduce = useReducedMotion();
    if (reduce) return <div ref={ref as never} {...(rest as never)}>{children}</div>;
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
        {...rest}
      >
        {children}
      </motion.div>
    );
  },
);
MotionReveal.displayName = "MotionReveal";

/** Page-level fade-in for route content. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}