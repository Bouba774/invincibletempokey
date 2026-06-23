import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/licenses")({
  head: () => ({ meta: [{ title: "Licences Open Source — TempoKey" }] }),
  component: LicensesPage,
});

interface Dep {
  name: string;
  license: string;
  url: string;
  purpose: string;
}

// Curated list of the principal runtime dependencies. The generated APK ships
// these libraries. Build-time only tooling (Vite, TypeScript, ESLint, …) is
// not redistributed and therefore not listed here.
const DEPENDENCIES: Dep[] = [
  { name: "React", license: "MIT", url: "https://github.com/facebook/react", purpose: "UI runtime" },
  { name: "TanStack Start / Router / Query", license: "MIT", url: "https://tanstack.com", purpose: "Routing & data layer" },
  { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com", purpose: "Design system" },
  { name: "shadcn/ui", license: "MIT", url: "https://ui.shadcn.com", purpose: "UI primitives" },
  { name: "Radix UI", license: "MIT", url: "https://www.radix-ui.com", purpose: "Accessible primitives" },
  { name: "Lucide", license: "ISC", url: "https://lucide.dev", purpose: "Icon set" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand", purpose: "State management" },
  { name: "Sonner", license: "MIT", url: "https://sonner.emilkowal.ski", purpose: "Toast notifications" },
  { name: "Framer Motion", license: "MIT", url: "https://www.framer.com/motion", purpose: "Animations" },
  { name: "Capacitor", license: "MIT", url: "https://capacitorjs.com", purpose: "Android native shell" },
  { name: "@capacitor/filesystem", license: "MIT", url: "https://capacitorjs.com/docs/apis/filesystem", purpose: "Scoped file access" },
  { name: "@capacitor/splash-screen", license: "MIT", url: "https://capacitorjs.com/docs/apis/splash-screen", purpose: "Splash screen" },
];

function LicensesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link
        to="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Licences Open Source</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        TempoKey est construit sur les épaules de ces formidables projets
        open source. Merci à leurs auteurs et mainteneurs.
      </p>

      <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60">
        {DEPENDENCIES.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{d.name}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                  {d.license}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.purpose}</p>
            </div>
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              source <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        Cette liste recense les dépendances majeures redistribuées dans l'APK.
        Les textes complets des licences sont disponibles dans chaque dépôt lié.
      </p>
    </div>
  );
}
