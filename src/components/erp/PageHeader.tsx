import { ReactNode } from "react";

// Plain CSS fade-in (no translateY) — prevents layout shift and keeps
// initial render cheap. The previous framer-motion animation caused a
// large CLS on every navigation and pulled in ~96KB of JS.
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 lg:pt-10 pb-4 sm:pb-6 max-w-[1400px] mx-auto w-full">
        <div className="space-y-1.5 page-header-fade">
          <h1 className="text-2xl sm:text-3xl lg:text-[32px] leading-tight font-bold tracking-[-0.022em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-[15px] text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 items-center page-header-fade">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
