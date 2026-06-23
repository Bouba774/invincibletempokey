import { useEffect, useRef, useState, useCallback } from "react";
import { useLibraryStore, type Track } from "@/lib/library-store";
import {
  generateWaveform,
  getCachedWaveform,
  getMemoryWaveform,
  type WaveformData,
} from "@/lib/audio/waveform";
import { usePlayerStore } from "@/lib/audio/player-store";

interface WaveformProps {
  track: Track;
  height?: number;
  className?: string;
  interactive?: boolean;
}

export function Waveform({
  track,
  height = 48,
  className,
  interactive = true,
}: WaveformProps) {
  const [data, setData] = useState<WaveformData | null>(() =>
    getMemoryWaveform(track.id) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getFile = useLibraryStore((s) => s.getFile);
  const fileMapVersion = useLibraryStore((s) => s.fileMapVersion);

  const isCurrent = usePlayerStore((s) => s.currentId === track.id);
  const positionSec = usePlayerStore((s) =>
    s.currentId === track.id ? s.positionSec : 0,
  );
  const durationSec = usePlayerStore((s) =>
    s.currentId === track.id ? s.durationSec : 0,
  );
  const seekRatio = usePlayerStore((s) => s.seekRatio);
  const play = usePlayerStore((s) => s.play);

  // Load / generate waveform
  useEffect(() => {
    let cancelled = false;
    if (data) return;
    (async () => {
      const cached = await getCachedWaveform(track.id);
      if (cancelled) return;
      if (cached) {
        setData(cached);
        return;
      }
      const file = getFile(track.id);
      if (!file) return;
      setLoading(true);
      const generated = await generateWaveform(track.id, file);
      if (cancelled) return;
      setLoading(false);
      if (generated) setData(generated);
    })();
    return () => {
      cancelled = true;
    };
  }, [track.id, data, getFile, fileMapVersion]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const peaks = data?.peaks ?? [];
    const total = peaks.length || 120;
    const barCount = Math.min(total, Math.max(40, Math.floor(w / 3)));
    const step = total / barCount;
    const barW = Math.max(1, w / barCount - 1);
    const mid = h / 2;
    const progress =
      isCurrent && (durationSec || data?.durationSec)
        ? positionSec / (durationSec || data!.durationSec)
        : 0;

    const baseColor = "rgba(148, 163, 184, 0.45)";
    const activeColor = "rgba(56, 189, 248, 1)";

    for (let i = 0; i < barCount; i++) {
      const peak = peaks.length
        ? peaks[Math.floor(i * step)] ?? 0
        : 0.35 + 0.4 * Math.sin(i * 0.4);
      const barH = Math.max(2, peak * (h - 4));
      const x = i * (w / barCount);
      const ratio = i / barCount;
      ctx.fillStyle = ratio <= progress ? activeColor : baseColor;
      ctx.fillRect(x, mid - barH / 2, barW, barH);
    }
  }, [data, height, isCurrent, positionSec, durationSec]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handle = () => draw();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [draw]);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (isCurrent) {
        seekRatio(ratio);
      } else {
        void play(track).then(() => {
          // Defer seek until duration is known
          setTimeout(() => seekRatio(ratio), 120);
        });
      }
    },
    [interactive, isCurrent, seekRatio, play, track],
  );

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-md ${
        interactive ? "cursor-pointer" : ""
      } ${className ?? ""}`}
      style={{ height }}
      role={interactive ? "slider" : undefined}
      aria-label="Waveform"
    >
      <canvas ref={canvasRef} />
      {loading && !data && (
        <div className="absolute inset-0 grid place-items-center text-[10px] uppercase tracking-wider text-muted-foreground">
          Génération…
        </div>
      )}
    </div>
  );
}
