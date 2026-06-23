// Fast file fingerprint: SHA-256 over head + tail + size.
// Avoids reading the whole file for large tracks while staying collision-safe in practice.

const HEAD_BYTES = 256 * 1024;
const TAIL_BYTES = 256 * 1024;

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export async function hashFile(file: File): Promise<string> {
  const size = file.size;
  const head = await file.slice(0, Math.min(HEAD_BYTES, size)).arrayBuffer();
  const tail =
    size > HEAD_BYTES + TAIL_BYTES
      ? await file.slice(size - TAIL_BYTES).arrayBuffer()
      : new ArrayBuffer(0);

  const combined = new Uint8Array(head.byteLength + tail.byteLength + 8);
  combined.set(new Uint8Array(head), 0);
  combined.set(new Uint8Array(tail), head.byteLength);
  new DataView(combined.buffer).setFloat64(head.byteLength + tail.byteLength, size, true);

  const digest = await crypto.subtle.digest("SHA-256", combined);
  return toHex(digest);
}