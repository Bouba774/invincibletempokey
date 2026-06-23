/**
 * Indicateur "now-playing" — 3 barres animées façon égaliseur.
 * Très discret, s'arrête en pause.
 */
interface Props {
  playing: boolean;
  className?: string;
}

export function NowPlayingBars({ playing, className = "" }: Props) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-3 w-3 items-end justify-between gap-[1px] ${className}`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] rounded-sm bg-[var(--accent)]"
          style={{
            height: playing ? undefined : "30%",
            animation: playing
              ? `eq-bar 0.9s ${i * 0.12}s ease-in-out infinite`
              : "none",
          }}
        />
      ))}
    </span>
  );
}
