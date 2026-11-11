import Link from "next/link";
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-4">404</p><h1 className="h-display">Page not found</h1>
      <Link href="/" className="btn btn-primary mt-8">Back to home</Link>
    </main>
  );
}
