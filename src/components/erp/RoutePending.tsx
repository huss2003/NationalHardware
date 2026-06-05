import { StatCardsSkeleton, TableSkeleton } from "@/components/erp/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Generic page-level pending fallback shown while a route's code chunk and/or
 * data is loading. It mirrors the standard page shell (header + content) so
 * navigation feels instant instead of flashing a blank white screen.
 */
export function RoutePending() {
  return (
    <div className="route-pending">
      <header className="page-header">
        <div className="flex flex-wrap items-end justify-between gap-4 px-8 pt-10 pb-6 max-w-[1400px] mx-auto w-full">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      </header>
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        <StatCardsSkeleton count={4} />
        <Card className="overflow-hidden p-2">
          <TableSkeleton rows={8} columns={5} />
        </Card>
      </div>
    </div>
  );
}