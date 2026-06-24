import type { KeyResult } from "./key";

// Camelot wheel mapping: tonic (pitch class) + mode -> Camelot code.
// Pitch classes: 0=C, 1=C#, ... 11=B.
const MAJOR: Record<number, string> = {
  0: "8B",  // C
  7: "9B",  // G
  2: "10B", // D
  9: "11B", // A
  4: "12B", // E
  11: "1B", // B
  6: "2B",  // F#
  1: "3B",  // C# / Db
  8: "4B",  // G# / Ab
  3: "5B",  // D# / Eb
  10: "6B", // A# / Bb
  5: "7B",  // F
};
const MINOR: Record<number, string> = {
  9: "8A",  // A
  4: "9A",  // E
  11: "10A", // B
  6: "11A", // F#
  1: "12A", // C#
  8: "1A",  // G#
  3: "2A",  // D#
  10: "3A", // A# / Bb
  5: "4A",  // F
  0: "5A",  // C
  7: "6A",  // G
  2: "7A",  // D
};

const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function toCamelot(key: KeyResult): string | null {
  const pc = NOTE_TO_PC[key.note];
  if (pc === undefined) return null;
  return (key.mode === "major" ? MAJOR : MINOR)[pc] ?? null;
}

/** Camelot lookup from a raw note + mode pair (works with Essentia output). */
export function camelotFor(note: string, mode: "major" | "minor"): string | null {
  const pc = NOTE_TO_PC[note];
  if (pc === undefined) return null;
  return (mode === "major" ? MAJOR : MINOR)[pc] ?? null;
}

export function noteToPc(note: string): number | null {
  const pc = NOTE_TO_PC[note];
  return pc === undefined ? null : pc;
}