import type { Track } from "./library-store";

export type DuplicateKind = "exact" | "probable";

export interface DuplicateGroup {
  id: string;
  kind: DuplicateKind;
  key: string;
  tracks: Track[];
}

// Normalize title for "probable" duplicate matching.
// Strips: extension, leading numbers, trailing tags like (final), [v2], -copy, "remastered" etc.
const NOISE_WORDS = [
  "final",
  "finale",
  "copy",
  "copie",
  "remaster",
  "remastered",
  "edit",
  "master",
  "mix",
  "version",
  "original",
];

export function normalizeTitle(t: string): string {
  let s = t.toLowerCase();
  // strip extension
  s = s.replace(/\.[a-z0-9]{2,5}$/i, "");
  // remove bracket groups
  s = s.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  // remove v2, v.2, version markers
  s = s.replace(/\bv\.?\s*\d+\b/g, " ");
  // remove noise words
  for (const w of NOISE_WORDS) s = s.replace(new RegExp(`\\b${w}\\b`, "g"), " ");
  // remove leading track numbers "01 - "
  s = s.replace(/^\s*\d{1,3}[\s._-]+/, "");
  // collapse non alphanum
  s = s.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return s;
}

export interface DuplicateScanOptions {
  bpmTolerance?: number; // BPM diff allowed for probable group
  durationTolerance?: number; // seconds
}

export function findDuplicates(
  tracks: Track[],
  opts: DuplicateScanOptions = {},
): DuplicateGroup[] {
  const bpmTol = opts.bpmTolerance ?? 1;
  const durTol = opts.durationTolerance ?? 2;

  const groups: DuplicateGroup[] = [];

  // 1. Exact via fileHash
  const byHash = new Map<string, Track[]>();
  for (const t of tracks) {
    if (!t.fileHash) continue;
    const arr = byHash.get(t.fileHash) ?? [];
    arr.push(t);
    byHash.set(t.fileHash, arr);
  }
  const consumed = new Set<string>();
  for (const [hash, list] of byHash) {
    if (list.length < 2) continue;
    list.forEach((t) => consumed.add(t.id));
    groups.push({
      id: `hash:${hash}`,
      kind: "exact",
      key: list[0].title,
      tracks: list,
    });
  }

  // 2. Probable: normalized title bucket, refine by duration & bpm
  const byNorm = new Map<string, Track[]>();
  for (const t of tracks) {
    if (consumed.has(t.id)) continue;
    const norm = normalizeTitle(t.title || t.fileName);
    if (!norm) continue;
    const arr = byNorm.get(norm) ?? [];
    arr.push(t);
    byNorm.set(norm, arr);
  }

  for (const [norm, list] of byNorm) {
    if (list.length < 2) continue;
    // cluster within list by duration/bpm proximity
    const remaining = [...list];
    while (remaining.length > 1) {
      const seed = remaining.shift()!;
      const cluster: Track[] = [seed];
      for (let i = remaining.length - 1; i >= 0; i--) {
        const o = remaining[i];
        const dOk =
          seed.durationSec == null ||
          o.durationSec == null ||
          Math.abs(seed.durationSec - o.durationSec) <= durTol;
        const bOk =
          seed.bpm == null ||
          o.bpm == null ||
          Math.abs(seed.bpm - o.bpm) <= bpmTol;
        if (dOk && bOk) {
          cluster.push(o);
          remaining.splice(i, 1);
        }
      }
      if (cluster.length >= 2) {
        groups.push({
          id: `norm:${norm}:${cluster[0].id}`,
          kind: "probable",
          key: norm,
          tracks: cluster,
        });
      }
    }
  }

  // Sort: exact first, then by size desc
  groups.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "exact" ? -1 : 1;
    return b.tracks.length - a.tracks.length;
  });

  return groups;
}
