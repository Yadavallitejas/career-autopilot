import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="min-h-full pb-20 md:pb-6">
      {/* Page header */}
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
        <Skeleton className="h-5 w-20 mb-1.5" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Connected Accounts */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
          <div className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72" />
          </div>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Plan & Billing */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-60" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-8 w-48 rounded-xl" />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6 space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-24 bg-red-900/40" />
            <Skeleton className="h-3 w-56 bg-zinc-800/60" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-32 rounded-lg bg-red-900/30" />
          </div>
        </div>
      </div>
    </div>
  )
}
