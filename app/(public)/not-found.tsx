import { ButtonLink } from "@/components/ui/Button";
export default function NotFound() {
  return (
    <section className="section"><div className="container-x max-w-2xl text-center">
      <p className="eyebrow mb-4">404</p><h1 className="h-display">Page not found</h1>
      <p className="lead mx-auto mt-6">The page you're looking for has moved or doesn't exist. Take a breath — here are some good places to start.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3"><ButtonLink href="/">Home</ButtonLink><ButtonLink href="/schedule" variant="outline">Schedule</ButtonLink><ButtonLink href="/contact" variant="outline">Contact</ButtonLink></div>
    </div></section>
  );
}
