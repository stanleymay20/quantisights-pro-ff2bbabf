import { cn } from "@/lib/utils";

interface DashboardSkeletonProps {
  className?: string;
}

const Pulse = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-lg bg-muted/60", className)} />
);

const DashboardSkeleton = ({ className }: DashboardSkeletonProps) => (
  <div className={cn("space-y-6", className)}>
    {/* Status bar skeleton */}
    <div className="flex items-center gap-6">
      {[1, 2, 3, 4].map(i => (
        <Pulse key={i} className="h-4 w-24" />
      ))}
    </div>

    {/* Greeting skeleton */}
    <div className="space-y-2">
      <Pulse className="h-7 w-64" />
      <Pulse className="h-4 w-40" />
    </div>

    {/* KPI cards skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass-card p-5 rounded-xl space-y-3">
          <div className="flex justify-between">
            <Pulse className="h-3 w-16" />
            <Pulse className="h-4 w-4 rounded" />
          </div>
          <Pulse className="h-8 w-28" />
        </div>
      ))}
    </div>

    {/* Charts skeleton */}
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 glass-card p-6 rounded-xl">
        <Pulse className="h-4 w-32 mb-4" />
        <Pulse className="h-56 w-full rounded-lg" />
      </div>
      <div className="glass-card p-6 rounded-xl">
        <Pulse className="h-4 w-36 mb-4" />
        <Pulse className="h-48 w-48 rounded-full mx-auto" />
      </div>
    </div>

    {/* Intelligence row skeleton */}
    <div className="grid lg:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card p-6 rounded-xl space-y-3">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-3 w-32" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(j => (
              <Pulse key={j} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export { DashboardSkeleton };
