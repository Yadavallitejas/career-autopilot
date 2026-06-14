import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          404
        </h1>
        <h2 className="text-xl font-semibold text-foreground mt-4">
          Page not found
        </h2>
        <p className="text-muted-foreground max-w-[500px] mx-auto mt-2">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
        </p>
      </div>

      <div className="mt-4">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
