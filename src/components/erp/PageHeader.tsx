import { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="flex flex-wrap items-end justify-between gap-4 px-8 pt-10 pb-6 max-w-[1400px] mx-auto w-full">
        <div className="space-y-1.5">
          <h1 className="text-[32px] leading-tight font-bold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] text-muted-foreground max-w-2xl">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex gap-2 items-center">{actions}</div>}
      </div>
    </header>
  );
}
