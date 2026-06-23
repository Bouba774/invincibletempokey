import { camelotTone } from "@/lib/viz";

interface Props {
  code: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "solid" | "soft";
  className?: string;
}

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-5 min-w-[28px] px-1.5 text-[10px]",
  sm: "h-6 min-w-[32px] px-2 text-[11px]",
  md: "h-8 min-w-[40px] px-2.5 text-sm",
  lg: "h-10 min-w-[52px] px-3 text-base",
};

export function CamelotBadge({
  code,
  size = "sm",
  variant = "solid",
  className = "",
}: Props) {
  const tone = camelotTone(code);
  const sz = SIZES[size];
  const label = code ? code.toUpperCase() : "—";
  if (variant === "soft") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md font-semibold tabular-nums tracking-tight ring-1 ${sz} ${className}`}
        style={{
          background: tone.soft,
          color: tone.bg,
          boxShadow: `inset 0 0 0 1px ${tone.border}`,
        }}
        title={`Camelot ${label} · ${tone.family}`}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums tracking-tight shadow-sm ${sz} ${className}`}
      style={{
        background: tone.bg,
        color: tone.fg,
        boxShadow: `0 1px 0 0 ${tone.border}, 0 8px 18px -10px ${tone.bg}`,
      }}
      title={`Camelot ${label} · ${tone.family}`}
    >
      {label}
    </span>
  );
}
