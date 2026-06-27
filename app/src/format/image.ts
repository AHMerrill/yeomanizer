// Shrink dropped enclosure images in-memory: cap the long edge (~2000px ≈ 300 DPI at letter width,
// plenty for print) and re-encode. Cuts file size a lot — which matters both for the in-document
// enclosure and for the round-trip metadata that rides along in the saved file. PDFs and small
// images pass through untouched (re-compressing a PDF in the browser would risk its vector text).
import type { AttachedFile } from '../types';

function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export async function shrinkImage(file: File, maxEdge = 2000, quality = 0.85): Promise<AttachedFile> {
  const dataUrl = await readDataUrl(file);
  if (!file.type.startsWith('image/') || typeof document === 'undefined') {
    return { name: file.name, type: file.type, dataUrl };
  }
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('image load failed'));
      img.src = dataUrl;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale >= 1) return { name: file.name, type: file.type, dataUrl }; // already small enough
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { name: file.name, type: file.type, dataUrl };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // re-encode in the same family: JPEG stays JPEG (lossy, tiny); everything else → PNG (crisp)
    const outType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const out = canvas.toDataURL(outType, outType === 'image/jpeg' ? quality : undefined);
    // keep whichever is smaller (re-encoding a simple PNG can occasionally grow it)
    return out.length < dataUrl.length
      ? { name: file.name, type: outType, dataUrl: out }
      : { name: file.name, type: file.type, dataUrl };
  } catch {
    return { name: file.name, type: file.type, dataUrl };
  }
}
