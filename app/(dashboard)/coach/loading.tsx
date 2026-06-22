import { Skeleton } from '@/components/ui/skeleton'

export default function CoachLoading() {
  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Skeleton className="h-5 w-28 mb-1.5" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      {/* Chat area */}
      <div className="flex-1 px-4 sm:px-6 py-6 space-y-4 overflow-hidden">
        {/* AI message */}
        <div className="flex gap-3 max-w-2xl">
          <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-4/6" />
          </div>
        </div>

        {/* User message */}
        <div className="flex gap-3 max-w-xl ml-auto flex-row-reverse">
          <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4 ml-auto" />
          </div>
        </div>

        {/* AI message */}
        <div className="flex gap-3 max-w-2xl">
          <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 sm:px-6 py-4 border-t border-zinc-800">
        <div className="flex gap-3 items-end">
          <Skeleton className="flex-1 h-12 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        </div>
      </div>
    </div>
  )
}
