import { Skeleton } from '@/components/ui/skeleton'

export default function ResumeLoading() {
  return (
    <div className="h-full pb-20 md:pb-0">
      {/* Page header */}
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Skeleton className="h-5 w-20 mb-1.5" />
        <Skeleton className="h-3.5 w-72" />
      </div>

      {/* Split layout skeleton */}
      <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className="w-full md:w-[280px] border-b md:border-b-0 md:border-r border-zinc-800 p-4 space-y-3">
          <Skeleton className="h-3 w-24 mb-4" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="py-3 border-b border-zinc-800/60 space-y-1.5 last:border-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>

        {/* Preview pane */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <Skeleton className="flex-1 m-4 rounded-lg" style={{ minHeight: '600px' }} />
        </div>
      </div>
    </div>
  )
}
