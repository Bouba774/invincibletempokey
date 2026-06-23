import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { usePlayerStore, formatTime } from "@/lib/audio/player-store";
import { useLibraryStore } from "@/lib/library-store";
import { Waveform } from "./Waveform";

export function FloatingPlayer() {
  const currentId = usePlayerStore((s) => s.currentId);
  const currentTitle = usePlayerStore((s) => s.currentTitle);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const position = usePlayerStore((s) => s.positionSec);
  const duration = usePlayerStore((s) => s.durationSec);
  const volume = usePlayerStore((s) => s.volume);
  const error = usePlayerStore((s) => s.error);
  const toggle = usePlayerStore((s) => s.toggle);
  const stop = usePlayerStore((s) => s.stop);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const seekRatio = usePlayerStore((s) => s.seekRatio);

  const library = useLibraryStore((s) => s.library);
  const track = useMemo(
    () => library?.tracks.find((t) => t.id === currentId) ?? null,
    [library, currentId],
  );

  const [volOpen, setVolOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (currentId) setMounted(true);
  }, [currentId]);

  if (!currentId || !mounted) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div
      className="android-fixed-layer fixed inset-x-2 z-50"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-[var(--surface-elevated)]/95 p-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Lecture"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--primary-foreground)] transition-transform active:scale-95"
            style={{ background: "var(--gradient-primary)" }}
          >
            {isLoading ? (
              <span className="h-3 w-3 animate-pulse rounded-full bg-white/70" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 translate-x-[1px]" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-sm font-medium text-foreground">
                {currentTitle ?? "—"}
              </div>
              <div className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatTime(position)} / {formatTime(duration)}
              </div>
            </div>
            {track && (
              <div className="mt-0.5 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
                <span>{track.bpm ?? "—"} BPM</span>
                <span className="text-border">·</span>
                <span>{track.camelot ?? "—"}</span>
                {track.bpmConfidence != null && (
                  <>
                    <span className="text-border">·</span>
                    <span className="text-[var(--primary-glow)]">
                      {Math.round(track.bpmConfidence * 100)}%
                    </span>
                  </>
                )}
                {track.suspect && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 text-[9px] font-semibold text-amber-300">
                    À vérifier
                  </span>
                )}
              </div>
            )}
            {track ? (
              <div className="mt-1.5">
                <Waveform track={track} height={28} />
              </div>
            ) : (
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-base,#0f172a)]/60"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekRatio((e.clientX - rect.left) / rect.width);
                }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress * 100}%`,
                    background: "var(--gradient-primary)",
                  }}
                />
              </div>
            )}
            {error && (
              <div className="mt-1 truncate text-[11px] text-[var(--destructive,#ef4444)]">
                {error}
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setVolOpen((v) => !v)}
              aria-label="Volume"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            {volOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-40 rounded-xl border border-border bg-[var(--surface-elevated)] p-3 shadow-xl animate-scale-in">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-[var(--primary,#38bdf8)]"
                />
                <div className="mt-1 text-center text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(volume * 100)}%
                </div>
              </div>
            )}
          </div>

          <button
            onClick={stop}
            aria-label="Fermer le lecteur"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
