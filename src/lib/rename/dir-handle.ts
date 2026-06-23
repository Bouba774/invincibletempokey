import { createStore, get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

/**
 * Wraps the File System Access API directory handle for the active library.
 * Required to physically rename files on the local filesystem.
 */

const store = createStore("tempokey-fs", "handles");
const KEY = (libraryId: string) => `dir:${libraryId}`;

type Mode = "read" | "readwrite";

// FileSystemDirectoryHandle and friends are only present in browsers that
// implement the File System Access API. Use a loose alias to stay portable.
type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (opts: { mode: Mode }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: Mode }) => Promise<PermissionState>;
};

export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export async function pickDirectoryHandle(): Promise<DirHandle | null> {
  if (!isFsAccessSupported()) return null;
  type Picker = (opts?: { mode?: Mode; id?: string }) => Promise<DirHandle>;
  const picker = (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker;
  try {
    return await picker({ mode: "readwrite", id: "tempokey-library" });
  } catch {
    return null;
  }
}

/**
 * Recursively walk a FileSystemDirectoryHandle and return all contained files
 * as a flat `File[]` where each file carries a `webkitRelativePath` matching
 * `<rootName>/<sub>/<file>` so downstream code can derive the library name
 * exactly like the `<input webkitdirectory>` path.
 */
export async function filesFromDirectoryHandle(
  root: DirHandle,
  onProgress?: (count: number) => void,
): Promise<File[]> {
  const out: File[] = [];
  async function walk(dir: DirHandle, prefix: string) {
    const iter = (dir as unknown as {
      entries: () => AsyncIterable<[string, FileSystemHandle]>;
    }).entries();
    for await (const [name, entry] of iter) {
      const rel = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === "file") {
        try {
          const f = await (entry as FileSystemFileHandle).getFile();
          // Patch webkitRelativePath so existing import code works unchanged.
          try {
            Object.defineProperty(f, "webkitRelativePath", {
              value: rel,
              configurable: true,
            });
          } catch {
            /* ignore */
          }
          out.push(f);
          if (out.length % 50 === 0) onProgress?.(out.length);
        } catch {
          /* skip unreadable files */
        }
      } else if (entry.kind === "directory") {
        await walk(entry as DirHandle, rel);
      }
    }
  }
  await walk(root, root.name);
  onProgress?.(out.length);
  return out;
}

export async function saveDirectoryHandle(libraryId: string, handle: DirHandle): Promise<void> {
  try {
    await idbSet(KEY(libraryId), handle, store);
  } catch {
    /* persistence is best-effort */
  }
}

export async function loadDirectoryHandle(libraryId: string): Promise<DirHandle | null> {
  try {
    const h = (await idbGet(KEY(libraryId), store)) as DirHandle | undefined;
    return h ?? null;
  } catch {
    return null;
  }
}

export async function forgetDirectoryHandle(libraryId: string): Promise<void> {
  try {
    await idbDel(KEY(libraryId), store);
  } catch {
    /* ignore */
  }
}

export async function ensurePermission(handle: DirHandle, mode: Mode = "readwrite"): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const current = await handle.queryPermission({ mode });
  if (current === "granted") return true;
  const next = await handle.requestPermission({ mode });
  return next === "granted";
}

/** Resolve a file handle given a relative path "Folder/sub/file.mp3" with the root folder name skipped. */
export async function resolveFileHandle(
  root: DirHandle,
  relativePath: string,
): Promise<{ parent: DirHandle; handle: FileSystemFileHandle; name: string } | null> {
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // The root's directory name is typically the first segment.
  const startsWithRoot = parts[0] === root.name;
  const segments = startsWithRoot ? parts.slice(1) : parts;
  if (segments.length === 0) return null;

  const fileName = segments[segments.length - 1];
  let dir: DirHandle = root;
  for (let i = 0; i < segments.length - 1; i++) {
    try {
      dir = (await dir.getDirectoryHandle(segments[i])) as DirHandle;
    } catch {
      return null;
    }
  }
  try {
    const handle = await dir.getFileHandle(fileName);
    return { parent: dir, handle, name: fileName };
  } catch {
    return null;
  }
}

/**
 * Try to rename a file within its current directory.
 * Uses FileSystemFileHandle.move(name) which is Chromium-based.
 * Returns the new (existing) file handle on success.
 */
export async function renameFileInPlace(
  handle: FileSystemFileHandle,
  newName: string,
): Promise<boolean> {
  type Movable = FileSystemFileHandle & { move?: (name: string) => Promise<void> };
  const movable = handle as Movable;
  if (typeof movable.move !== "function") return false;
  try {
    await movable.move(newName);
    return true;
  } catch {
    return false;
  }
}