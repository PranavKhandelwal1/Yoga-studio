"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-4">Something went wrong</p><h1 className="h-section">We couldn't load this page</h1>
      <p className="lead mt-4">Please try again. If the problem continues, contact us.</p>
      <button onClick={reset} className="btn btn-primary mt-8">Try again</button>
    </main>
  );
}
