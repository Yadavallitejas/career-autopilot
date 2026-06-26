import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24 md:pb-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3.5 w-44" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Table header */}
      <Skeleton className="h-5 w-40" />

      {/* Table rows */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex gap-8">
            {['w-12', 'w-16', 'w-48', 'w-20', 'w-20'].map((w, i) => (
              <Skeleton key={i} className={`h-3 ${w}`} />
            ))}
          </div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-border last:border-0 flex items-center gap-8">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-48 hidden sm:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
