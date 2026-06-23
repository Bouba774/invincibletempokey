import type { Track } from "./library-store";

export type SortKey =
  | "import"
  | "bpm-asc"
  | "bpm-desc"
  | "camelot"
  | "duration"
  | "title";

export type DurationBucket = "short" | "medium" | "long";
export type AnalysisFilter = "any" | "analyzed" | "pending" | "error";

export interface LibraryFilters {
  bpmMin: number | null;
  bpmMax: number | null;
  camelot: Set<string>;
  durations: Set<DurationBucket>;
  analysis: AnalysisFilter;
}

export const DEFAULT_FILTERS: LibraryFilters = {
  bpmMin: null,
  bpmMax: null,
  camelot: new Set(),
  durations: new Set(),
  analysis: "any",
};

export const CAMELOT_CODES = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(
  (n) => [`${n}A`, `${n}B`],
);

const CAMELOT_ORDER = new Map<string, number>(
  CAMELOT_CODES.map((c, i) => [c, i]),
);

export interface ParsedQuery {
  text: string[];
  bpmExact: number | null;
  bpmRange: [number, number] | null;
  camelot: string[];
}

const BPM_RANGE_RE = /^(\d{2,3})\s*[-–]\s*(\d{2,3})$/;
const BPM_SINGLE_RE = /^(\d{2,3})$/;
const CAMELOT_RE = /^(1[0-2]|[1-9])[ab]$/i;

export function parseQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = { text: [], bpmExact: null, bpmRange: null, camelot: [] };
  if (!raw.trim()) return out;
  const tokens = raw.trim().split(/\s+/);
  for (const tok of tokens) {
    let m = BPM_RANGE_RE.exec(tok);
    if (m) {
      const a = +m[1];
      const b = +m[2];
      out.bpmRange = [Math.min(a, b), Math.max(a, b)];
      continue;
    }
    m = BPM_SINGLE_RE.exec(tok);
    if (m) {
      out.bpmExact = +m[1];
      continue;
    }
    if (CAMELOT_RE.test(tok)) {
      out.camelot.push(tok.toUpperCase());
      continue;
    }
    out.text.push(tok.toLowerCase());
  }
  return out;
}

function durationBucket(sec: number | null): DurationBucket | null {
  if (sec == null) return null;
  if (sec < 180) return "short";
  if (sec <= 300) return "medium";
  return "long";
}

export function trackPassesFilters(
  t: Track,
  q: ParsedQuery,
  filters: LibraryFilters,
): boolean {
  if (q.bpmExact != null) {
    if (t.bpm == null || Math.abs(t.bpm - q.bpmExact) > 1) return false;
  }
  if (q.bpmRange) {
    if (t.bpm == null || t.bpm < q.bpmRange[0] || t.bpm > q.bpmRange[1]) {
      return false;
    }
  }
  if (q.camelot.length > 0) {
    if (!t.camelot || !q.camelot.includes(t.camelot.toUpperCase())) return false;
  }
  if (q.text.length > 0) {
    const hay = `${t.title} ${t.fileName}`.toLowerCase();
    if (!q.text.every((w) => hay.includes(w))) return false;
  }

  if (filters.bpmMin != null && (t.bpm == null || t.bpm < filters.bpmMin)) return false;
  if (filters.bpmMax != null && (t.bpm == null || t.bpm > filters.bpmMax)) return false;
  if (filters.camelot.size > 0) {
    if (!t.camelot || !filters.camelot.has(t.camelot.toUpperCase())) return false;
  }
  if (filters.durations.size > 0) {
    const b = durationBucket(t.durationSec);
    if (!b || !filters.durations.has(b)) return false;
  }
  switch (filters.analysis) {
    case "analyzed":
      if (!t.analyzed) return false;
      break;
    case "pending":
      if (t.status !== "pending") return false;
      break;
    case "error":
      if (t.status !== "error") return false;
      break;
  }

  return true;
}

/** Apply search + filters without changing order (order is owned by the ordering store). */
export function applyFiltersOnly(
  tracks: Track[],
  query: string,
  filters: LibraryFilters,
): Track[] {
  const q = parseQuery(query);
  const out: Track[] = [];

  for (const t of tracks) {
    if (trackPassesFilters(t, q, filters)) out.push(t);
  }
  return out;
}

/** @deprecated — use applyFiltersOnly + ordering-store. Kept for backwards compat. */
export function applyFiltersAndSort(
  tracks: Track[],
  query: string,
  filters: LibraryFilters,
  sort: SortKey,
): Track[] {
  const filtered = applyFiltersOnly(tracks, query, filters);
  switch (sort) {
    case "bpm-asc":
      return filtered.sort((a, b) => (a.bpm ?? Infinity) - (b.bpm ?? Infinity));
    case "bpm-desc":
      return filtered.sort((a, b) => (b.bpm ?? -Infinity) - (a.bpm ?? -Infinity));
    case "camelot":
      return filtered.sort((a, b) => {
        const ai = a.camelot ? CAMELOT_ORDER.get(a.camelot.toUpperCase()) ?? 999 : 999;
        const bi = b.camelot ? CAMELOT_ORDER.get(b.camelot.toUpperCase()) ?? 999 : 999;
        return ai - bi;
      });
    case "duration":
      return filtered.sort((a, b) => (a.durationSec ?? Infinity) - (b.durationSec ?? Infinity));
    case "title":
      return filtered.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return filtered;
  }
}


export function filtersActiveCount(f: LibraryFilters): number {
  let n = 0;
  if (f.bpmMin != null) n++;
  if (f.bpmMax != null) n++;
  if (f.camelot.size > 0) n++;
  if (f.durations.size > 0) n++;
  if (f.analysis !== "any") n++;
  return n;
}
