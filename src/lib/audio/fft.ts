// In-place radix-2 Cooley-Tukey FFT. Length must be a power of two.
export function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n !== im.length) throw new Error("fft: length mismatch");
  if ((n & (n - 1)) !== 0) throw new Error("fft: length must be a power of two");

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cRe = 1;
      let cIm = 0;
      for (let k = 0; k < half; k++) {
        const xRe = re[i + k];
        const xIm = im[i + k];
        const yRe = re[i + k + half] * cRe - im[i + k + half] * cIm;
        const yIm = re[i + k + half] * cIm + im[i + k + half] * cRe;
        re[i + k] = xRe + yRe;
        im[i + k] = xIm + yIm;
        re[i + k + half] = xRe - yRe;
        im[i + k + half] = xIm - yIm;
        const nRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nRe;
      }
    }
  }
}