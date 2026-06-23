import type { Track } from "@/lib/library-store";

export type TemplateId =
  | "num2"
  | "num3"
  | "num4"
  | "bpm"
  | "bpm-key"
  | "dj-order"
  | "custom";

export interface TemplateOption {
  id: TemplateId;
  label: string;
  description: string;
  example: string;
}

export const TEMPLATES: TemplateOption[] = [
  { id: "num3", label: "Numérotation 001", description: "Préfixe à 3 chiffres", example: "001 - Track.mp3" },
  { id: "num2", label: "Numérotation 01", description: "Préfixe à 2 chiffres", example: "01 - Track.mp3" },
  { id: "num4", label: "Numérotation 0001", description: "Préfixe à 4 chiffres", example: "0001 - Track.mp3" },
  { id: "bpm", label: "BPM", description: "Préfixe BPM", example: "128 BPM - Track.mp3" },
  { id: "bpm-key", label: "BPM + Key", description: "Préfixe BPM et tonalité Camelot", example: "128 BPM - 8A - Track.mp3" },
  { id: "dj-order", label: "Ordre DJ", description: "Trié par BPM avec numérotation", example: "001 - 128 BPM - 8A - Track.mp3" },
  { id: "custom", label: "Personnalisé", description: "Format avec variables", example: "{ORDER} - {BPM} - {KEY} - {TITLE}" },
];

export const TEMPLATE_VARIABLES = [
  "{ORDER}",
  "{TITLE}",
  "{ARTIST}",
  "{BPM}",
  "{KEY}",
  "{CAMELOT}",
  "{ENERGY}",
  "{DURATION}",
  "{YEAR}",
  "{GENRE}",
] as const;

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;

export function sanitizeName(name: string): string {
  return name.replace(FORBIDDEN, "_").replace(/\s+/g, " ").trim();
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

function formatBpm(t: Track): string {
  return t.bpm != null ? `${Math.round(t.bpm)} BPM` : "—";
}

function formatCamelot(t: Track): string {
  return t.camelot ?? "—";
}

function formatKey(t: Track): string {
  return t.key ?? t.camelot ?? "—";
}

function formatDuration(t: Track): string {
  return t.duration ?? "—";
}

// ---------------------------------------------------------------------------
// Prefix cleaning
// ---------------------------------------------------------------------------

// Tokens that commonly appear as a *prefix* before the real title:
// - "128 BPM"         (BPM annotation)
// - "8A" / "12B"      (Camelot key)
// - "001" / "01"      (numbering, 1–4 digits)
const STRIP_TOKEN = /^(?:\d{1,4}\s*bpm|\d{1,2}[ab](?![a-z])|\d{1,4})/i;
const STRIP_SEPARATOR = /^[\s\-_|/\\.·•]+/;

/**
 * Strip common DJ-style prefixes (numbering, BPM, Camelot, separators) from
 * a base name. Works on the basename only (no extension). Idempotent.
 *
 * Examples:
 *   "01 - Gazo"                  -> "Gazo"
 *   "001 Gazo"                   -> "Gazo"
 *   "128 BPM - Gazo"             -> "Gazo"
 *   "125BPM_Gazo"                -> "Gazo"
 *   "01 | Gazo"                  -> "Gazo"
 *   "01_128 BPM_Gazo"            -> "Gazo"
 *   "001 - 8A - 128 BPM - Gazo"  -> "Gazo"
 */
export function cleanPrefix(base: string): string {
  let s = base;
  let safety = 16;
  while (safety-- > 0) {
    const before = s;
    s = s.replace(STRIP_SEPARATOR, "");
    s = s.replace(STRIP_TOKEN, "");
    if (s === before) break;
  }
  const out = s.trim();
  return out.length > 0 ? out : base.trim();
}

interface OrderingResult {
  ordered: Track[];
  orderById: Map<string, number>;
}

/**
 * We *always* preserve the caller's input order so renaming respects the
 * global active order chosen elsewhere in the app (Auto Mix Order, Harmonic
 * Mixing, Set Builder, manual reorder, BPM/Camelot sorts, etc.).
 */
function orderTracks(tracks: Track[]): OrderingResult {
  const ordered = tracks.slice();
  const orderById = new Map<string, number>();
  ordered.forEach((t, i) => orderById.set(t.id, i + 1));
  return { ordered, orderById };
}

function widthForCount(n: number): number {
  if (n < 100) return 2;
  if (n < 1000) return 3;
  if (n < 10000) return 4;
  return Math.max(4, String(n).length);
}

function buildName(
  template: TemplateId,
  customFormat: string,
  t: Track,
  title: string,
  order: number,
  total: number,
): string {
  const width = widthForCount(total);
  switch (template) {
    case "num2":
      return `${pad(order, 2)} - ${title}`;
    case "num3":
      return `${pad(order, 3)} - ${title}`;
    case "num4":
      return `${pad(order, 4)} - ${title}`;
    case "bpm":
      return `${formatBpm(t)} - ${title}`;
    case "bpm-key":
      return `${formatBpm(t)} - ${formatCamelot(t)} - ${title}`;
    case "dj-order":
      return `${pad(order, Math.max(3, width))} - ${formatBpm(t)} - ${formatCamelot(t)} - ${title}`;
    case "custom": {
      const w = Math.max(3, width);
      return customFormat
        .replace(/\{ORDER\}/g, pad(order, w))
        .replace(/\{BPM\}/g, formatBpm(t))
        .replace(/\{CAMELOT\}/g, formatCamelot(t))
        .replace(/\{KEY\}/g, formatKey(t))
        .replace(/\{TITLE\}/g, title)
        .replace(/\{ARTIST\}/g, title) // no separate artist field yet
        .replace(/\{ENERGY\}/g, "—")
        .replace(/\{DURATION\}/g, formatDuration(t))
        .replace(/\{YEAR\}/g, "—")
        .replace(/\{GENRE\}/g, "—");
    }
  }
}

export interface RenamePreviewItem {
  trackId: string;
  oldName: string;
  cleanedName: string;
  newName: string;
  oldPath: string;
  newPath: string;
  unchanged: boolean;
  conflict: boolean;
  duplicate: boolean;
}

export interface PreviewResult {
  items: RenamePreviewItem[];
  changeCount: number;
  conflictCount: number;
  duplicateCount: number;
}

export interface PreviewOptions {
  cleanPrefixes?: boolean;
}

/**
 * Build a full preview (no I/O). Detects intra-batch + intra-folder conflicts
 * and flags duplicates (multiple tracks aiming at the same final name).
 */
export function buildPreview(
  template: TemplateId,
  customFormat: string,
  tracks: Track[],
  options: PreviewOptions = {},
): PreviewResult {
  if (tracks.length === 0) {
    return { items: [], changeCount: 0, conflictCount: 0, duplicateCount: 0 };
  }

  const { ordered, orderById } = orderTracks(tracks);
  const total = ordered.length;
  const cleanEnabled = !!options.cleanPrefixes;

  // Per-directory tracking: assigned target names (with auto-suffix on dup),
  // plus desired names (pre-suffix) for duplicate detection.
  const usedPerDir = new Map<string, Set<string>>();
  const desiredPerDir = new Map<string, Map<string, number>>();
  const items: RenamePreviewItem[] = [];

  for (const t of ordered) {
    const order = orderById.get(t.id) ?? 1;
    const ext = t.extension ? `.${t.extension}` : "";
    const baseTitle = t.title;
    const cleaned = cleanEnabled ? cleanPrefix(baseTitle) : baseTitle;
    const titleForBuild = cleanEnabled ? cleaned : baseTitle;
    const rawBase = buildName(template, customFormat, t, titleForBuild, order, total);
    const safeBase = sanitizeName(rawBase) || titleForBuild;
    const desiredName = `${safeBase}${ext}`;

    const slashIdx = t.filePath.lastIndexOf("/");
    const dir = slashIdx > 0 ? t.filePath.slice(0, slashIdx) : "";

    const desiredCounter = desiredPerDir.get(dir) ?? new Map<string, number>();
    desiredCounter.set(desiredName.toLowerCase(), (desiredCounter.get(desiredName.toLowerCase()) ?? 0) + 1);
    desiredPerDir.set(dir, desiredCounter);

    const used = usedPerDir.get(dir) ?? new Set<string>();
    let finalName = desiredName;
    let duplicate = false;
    if (
      used.has(finalName.toLowerCase()) &&
      finalName.toLowerCase() !== t.fileName.toLowerCase()
    ) {
      duplicate = true;
      let i = 1;
      while (used.has(`${safeBase}_${i}${ext}`.toLowerCase())) i++;
      finalName = `${safeBase}_${i}${ext}`;
    }
    used.add(finalName.toLowerCase());
    usedPerDir.set(dir, used);

    const newPath = dir ? `${dir}/${finalName}` : finalName;
    items.push({
      trackId: t.id,
      oldName: t.fileName,
      cleanedName: cleanEnabled ? `${sanitizeName(cleaned) || cleaned}${ext}` : t.fileName,
      newName: finalName,
      oldPath: t.filePath,
      newPath,
      unchanged: finalName === t.fileName,
      conflict: false,
      duplicate,
    });
  }

  const changeCount = items.filter((i) => !i.unchanged).length;
  const duplicateCount = items.filter((i) => i.duplicate).length;
  return { items, changeCount, conflictCount: 0, duplicateCount };
}
