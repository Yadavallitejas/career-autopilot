import { Skeleton } from '@/components/ui/skeleton'

export default function PortfolioLoading() {
  return (
    <div className="h-full pb-20 md:pb-0">
      {/* Page header */}
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <Skeleton className="h-5 w-24 mb-1.5" />
        <Skeleton className="h-3.5 w-80" />
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* GitHub connection card */}
        <div className="rounded-2xl border border-border p-6 space-y-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-64" />
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>

        {/* Deploy settings card */}
        <div className="rounded-2xl border border-border p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
