import { Capacitor, registerPlugin } from "@capacitor/core";
import { createStore, get as idbGet, set as idbSet } from "idb-keyval";
import type { Library } from "@/lib/library-store";
import { useLibraryStore } from "@/lib/library-store";

export interface SafFileMeta {
  uri: string;
  name: string;
  relativePath: string;
  size: number;
  mime: string;
}

export interface FolderPickerPlugin {
  checkAudioPermission(): Promise<{ state: "granted" | "denied" | "blocked" | "unsupported" }>;
  requestAudioPermission(): Promise<{ state: "granted" | "denied" | "blocked" | "unsupported" }>;
  openAppSettings(): Promise<{ opened: boolean }>;
  pickFolder(): Promise<{ treeUri: string; name: string }>;
  listAudioFiles(opts: { treeUri: string }): Promise<{
    rootName: string;
    files: SafFileMeta[];
  }>;
  getPlayableUri(opts: { uri: string; name?: string; mime?: string; size?: number }): Promise<{
    uri: string;
    mime: string;
  }>;
  readFile(opts: { uri: string; offset?: number; length?: number }): Promise<{
    data: string;
  }>;
  hasPersistedAccess(opts: { treeUri: string }): Promise<{ granted: boolean }>;
  renameDocument(opts: { uri: string; newName: string }): Promise<{
    uri: string;
    name: string;
  }>;
}

export const FolderPicker = registerPlugin<FolderPickerPlugin>("FolderPicker");

export function isCapacitorAndroid(): boolean {
  try {
    return Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

const ACTIVE_TREE_KEY = "tempokey.activeTreeUri";
const ACTIVE_TREE_NAME_KEY = "tempokey.activeTreeName";
const safStore = createStore("tempokey-saf", "libraries");

interface AndroidLibraryMeta {
  libId: string;
  treeUri: string;
  name: string;
  importedAt: number;
  fileMetas?: Array<{ trackId: string; meta: SafFileMeta }>;
}

export function getSafMeta(file: File | undefined | null): SafFileMeta | null {
  if (!file) return null;
  const v = (file as unknown as { __safMeta?: unknown }).__safMeta;
  if (v && typeof v === "object") return v as SafFileMeta;
  return null;
}

export async function persistAndroidLibrary(
  libId: string,
  treeUri: string,
  name: string,
  entries?: Array<{ trackId: string; file: File }>,
): Promise<void> {
  try {
    const fileMetas = entries
      ?.map(({ trackId, file }) => {
        const meta = getSafMeta(file);
        return meta ? { trackId, meta } : null;
      })
      .filter((v): v is { trackId: string; meta: SafFileMeta } => !!v);
    const rec: AndroidLibraryMeta = {
      libId,
      treeUri,
      name,
      importedAt: Date.now(),
      fileMetas,
    };
    await idbSet(`saf:${libId}`, rec, safStore);
  } catch {
    /* best-effort */
  }
}

export async function updateAndroidTrackFileMeta(
  libId: string,
  trackId: string,
  meta: SafFileMeta,
): Promise<void> {
  try {
    const rec = await loadAndroidLibrary(libId);
    if (!rec) return;
    const fileMetas = [...(rec.fileMetas ?? [])];
    const i = fileMetas.findIndex((x) => x.trackId === trackId);
    if (i >= 0) fileMetas[i] = { trackId, meta };
    else fileMetas.push({ trackId, meta });
    await idbSet(`saf:${libId}`, { ...rec, fileMetas }, safStore);
  } catch {
    /* best-effort */
  }
}

export async function loadAndroidLibrary(
  libId: string,
): Promise<AndroidLibraryMeta | null> {
  try {
    const rec = (await idbGet(`saf:${libId}`, safStore)) as
      | AndroidLibraryMeta
      | undefined;
    return rec ?? null;
  } catch {
    return null;
  }
}

export function getActiveTreeUri(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_TREE_KEY);
}

function getActiveTreeName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_TREE_NAME_KEY);
}

export function setActiveTreeUri(uri: string, name?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_TREE_KEY, uri);
  if (name) window.localStorage.setItem(ACTIVE_TREE_NAME_KEY, name);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.replace(/\s+/g, "");
  const bin = atob(clean);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Wrap a SAF document descriptor as a `File` that lazily reads its bytes
 * through the native plugin only when the analyzer actually needs them.
 * `arrayBuffer()` and `slice(start, end).arrayBuffer()` are both supported
 * so the existing audio pipeline keeps working unchanged.
 */
export function safFileFromMeta(meta: SafFileMeta): File {
  const file = new File([new Uint8Array(0)], meta.name, {
    type: meta.mime || "",
    lastModified: Date.now(),
  });
  try {
    Object.defineProperty(file, "size", {
      value: meta.size,
      configurable: true,
    });
  } catch {
    /* ignore */
  }
  try {
    Object.defineProperty(file, "webkitRelativePath", {
      value: meta.relativePath,
      configurable: true,
    });
  } catch {
    /* ignore */
  }

  let cached: ArrayBuffer | null = null;

  const fullArrayBuffer = async (): Promise<ArrayBuffer> => {
    if (cached) return cached;
    const { data } = await FolderPicker.readFile({ uri: meta.uri });
    cached = base64ToArrayBuffer(data);
    return cached;
  };

  const sliceArrayBuffer = async (
    start: number,
    end: number,
  ): Promise<ArrayBuffer> => {
    const length = Math.max(0, end - start);
    if (length === 0) return new ArrayBuffer(0);
    const { data } = await FolderPicker.readFile({
      uri: meta.uri,
      offset: start,
      length,
    });
    return base64ToArrayBuffer(data);
  };

  (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
    fullArrayBuffer;

  (file as unknown as { slice: (s?: number, e?: number) => Blob }).slice = (
    start = 0,
    end = meta.size,
  ) => {
    const s = Math.max(0, Math.min(start, meta.size));
    const e = Math.max(s, Math.min(end, meta.size));
    const blob = new Blob([]) as Blob & {
      arrayBuffer: () => Promise<ArrayBuffer>;
      size: number;
    };
    try {
      Object.defineProperty(blob, "size", { value: e - s, configurable: true });
    } catch {
      /* ignore */
    }
    blob.arrayBuffer = () => sliceArrayBuffer(s, e);
    return blob;
  };

  // Tag the file so downstream code (audio player, rename engine) can detect
  // a SAF-backed handle and use the native plugin rather than blob URLs or
  // FileSystemFileHandle APIs (neither work on Android).
  try {
    Object.defineProperty(file, "__safUri", {
      value: meta.uri,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(file, "__safMeta", {
      value: meta,
      configurable: true,
      writable: true,
    });
  } catch {
    /* ignore */
  }
  return file;
}

export function getSafUri(file: File | undefined | null): string | null {
  if (!file) return null;
  const v = (file as unknown as { __safUri?: unknown }).__safUri;
  return typeof v === "string" ? v : null;
}

export async function getSafPlayableUrl(
  file: File,
): Promise<{ url: string; mime: string } | null> {
  const uri = getSafUri(file);
  if (!uri) return null;
  const meta = getSafMeta(file);
  const res = await FolderPicker.getPlayableUri({
    uri,
    name: file.name || meta?.name,
    mime: file.type || meta?.mime,
    size: file.size || meta?.size,
  });
  return {
    url: Capacitor.convertFileSrc?.(res.uri) ?? res.uri,
    mime: res.mime || file.type || meta?.mime || "",
  };
}

export async function pickAndroidFolder(): Promise<{
  rootName: string;
  treeUri: string;
  files: File[];
} | null> {
  // eslint-disable-next-line no-console
  console.log("ANDROID_PICKER_START");
  try {
    const { treeUri, name } = await FolderPicker.pickFolder();
    if (!treeUri) {
      console.warn("ANDROID_PICKER_FAIL no treeUri");
      return null;
    }
    setActiveTreeUri(treeUri, name);
    const { rootName, files: metas } = await FolderPicker.listAudioFiles({
      treeUri,
    });
    // eslint-disable-next-line no-console
    console.log("ANDROID_PICKER_SUCCESS", { treeUri, count: metas.length });
    return {
      rootName: rootName || name || "Bibliothèque",
      treeUri,
      files: metas.map(safFileFromMeta),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("ANDROID_PICKER_FAIL", err);
    return null;
  }
}

/**
 * Re-list the persisted SAF tree for `libId` and rebuild lazy `File` objects
 * backed by the native plugin. Returns null on web, when no persisted access
 * exists, or if the URI permission has been revoked.
 */
export async function restoreAndroidFiles(
  libId: string,
): Promise<{
  name: string;
  treeUri: string;
  files: File[];
  entries?: Array<{ trackId: string; file: File }>;
} | null> {
  if (!isCapacitorAndroid()) return null;
  let meta = await loadAndroidLibrary(libId);
  if (!meta) {
    const activeTreeUri = getActiveTreeUri();
    if (!activeTreeUri) return null;
    meta = {
      libId,
      treeUri: activeTreeUri,
      name: getActiveTreeName() || "Bibliothèque",
      importedAt: 0,
    };
  }
  try {
    const { granted } = await FolderPicker.hasPersistedAccess({
      treeUri: meta.treeUri,
    });
    if (!granted) return null;

    // Preferred cold-start path: rebuild the exact trackId → SAF document URI
    // mapping saved during import. This avoids fragile full-tree re-scans and
    // path matching when the app is reopened, so playback/rename works without
    // asking the user to re-import the library.
    if (meta.fileMetas && meta.fileMetas.length > 0) {
      const entries = meta.fileMetas.map(({ trackId, meta: fileMeta }) => ({
        trackId,
        file: safFileFromMeta(fileMeta),
      }));
      setActiveTreeUri(meta.treeUri, meta.name);
      return {
        name: meta.name,
        treeUri: meta.treeUri,
        files: entries.map((e) => e.file),
        entries,
      };
    }

    const { rootName, files: metas } = await FolderPicker.listAudioFiles({
      treeUri: meta.treeUri,
    });
    setActiveTreeUri(meta.treeUri, rootName || meta.name);
    return {
      name: rootName || meta.name,
      treeUri: meta.treeUri,
      files: metas.map(safFileFromMeta),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("ANDROID_RESTORE_FAIL", err);
    return null;
  }
}

/**
 * After hydration / restoreLast, rebuild the in-memory File map from the
 * persisted SAF tree so playback, analysis and renaming work without any
 * re-import.
 */
export async function restoreFilesForLibrary(lib: Library): Promise<boolean> {
  const restored = await restoreAndroidFiles(lib.id);
  if (!restored) return false;
  if (restored.entries && restored.entries.length > 0) {
    useLibraryStore.getState().setFiles(restored.entries);
    return true;
  }
  const byPath = new Map<string, File>();
  const byPathNoRoot = new Map<string, File>();
  const byName = new Map<string, File>();
  for (const f of restored.files) {
    const p =
      (f as unknown as { webkitRelativePath?: string }).webkitRelativePath ||
      f.name;
    byPath.set(p, f);
    const noRoot = p.includes("/") ? p.slice(p.indexOf("/") + 1) : p;
    byPathNoRoot.set(noRoot, f);
    byName.set(f.name, f);
  }
  const entries: Array<{ trackId: string; file: File }> = [];
  for (const t of lib.tracks) {
    const noRoot = t.filePath.includes("/")
      ? t.filePath.slice(t.filePath.indexOf("/") + 1)
      : t.filePath;
    const f =
      byPath.get(t.filePath) ??
      byPathNoRoot.get(noRoot) ??
      byPath.get(t.fileName) ??
      byName.get(t.fileName);
    if (f) entries.push({ trackId: t.id, file: f });
  }
  if (entries.length === 0) return false;
  useLibraryStore.getState().setFiles(entries);
  await persistAndroidLibrary(lib.id, restored.treeUri, restored.name, entries);
  return true;
}