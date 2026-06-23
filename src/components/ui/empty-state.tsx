import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }: Props) {
  return (
    <div
      className={`mx-auto flex max-w-sm flex-col items-center justify-center px-6 py-14 text-center animate-fade-in ${className}`}
    >
      {Icon && (
        <div
          className="mb-4 grid h-14 w-14 place-items-center rounded-2xl text-[var(--primary-glow)]"
          style={{
            background:
              "color-mix(in oklab, var(--primary) 12%, var(--surface-elevated))",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
