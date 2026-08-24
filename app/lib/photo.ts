export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Data URLs expand binary images by roughly one third and some browsers count
// stored strings as two-byte characters. Keeping the optimized blob below this
// budget leaves enough room for the rest of the resume in local storage, so a
// large upload remains silent and still survives a reload.
const MAX_PERSISTED_PHOTO_BYTES = Math.floor(1.5 * 1024 * 1024);
const DEFAULT_PHOTO_EDGE = 600;
const MAX_CANVAS_EDGE = 8192;
const MAX_CANVAS_PIXELS = 24_000_000;
const JPEG_MIN_QUALITY = 0.1;
const JPEG_SEARCH_STEPS = 10;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    const release = () => URL.revokeObjectURL(source);
    image.onerror = () => {
      release();
      reject(new Error("The photo could not be decoded."));
    };
    image.onload = () => {
      release();
      resolve(image);
    };
    image.src = source;
  });
}

function fittedSize(width: number, height: number, preserveDetail: boolean) {
  const edgeScale = preserveDetail
    ? Math.min(1, MAX_CANVAS_EDGE / Math.max(width, height))
    : Math.min(1, DEFAULT_PHOTO_EDGE / Math.max(width, height));
  const pixelScale = preserveDetail ? Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (width * height))) : 1;
  const scale = Math.min(edgeScale, pixelScale);
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function drawImage(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create an image canvas.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser could not encode the photo."))),
      "image/jpeg",
      quality,
    );
  });
}

async function encodeUnderLimit(image: HTMLImageElement, initialWidth: number, initialHeight: number) {
  let width = initialWidth;
  let height = initialHeight;
  let canvas = drawImage(image, width, height);
  let smallest = await encodeJpeg(canvas, JPEG_MIN_QUALITY);

  // Very large or noisy images can remain over the limit even at the lowest
  // JPEG quality. Reduce dimensions only as much as needed before selecting
  // the highest quality that fits at that size.
  while (smallest.size >= MAX_PERSISTED_PHOTO_BYTES && (width > 1 || height > 1)) {
    const scale = Math.min(0.92, Math.sqrt(MAX_PERSISTED_PHOTO_BYTES / smallest.size) * 0.96);
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
    canvas = drawImage(image, width, height);
    smallest = await encodeJpeg(canvas, JPEG_MIN_QUALITY);
  }

  let best = smallest;
  let lowerQuality = JPEG_MIN_QUALITY;
  let upperQuality = 1;
  for (let step = 0; step < JPEG_SEARCH_STEPS; step += 1) {
    const quality = (lowerQuality + upperQuality) / 2;
    const candidate = await encodeJpeg(canvas, quality);
    if (candidate.size < MAX_PERSISTED_PHOTO_BYTES) {
      best = candidate;
      lowerQuality = quality;
    } else {
      upperQuality = quality;
    }
  }
  return best;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The optimized photo could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function prepareResumePhoto(file: File) {
  const image = await loadImage(file);
  const oversized = file.size > MAX_PHOTO_BYTES;
  const size = fittedSize(image.naturalWidth, image.naturalHeight, oversized);
  const blob = oversized
    ? await encodeUnderLimit(image, size.width, size.height)
    : await encodeJpeg(drawImage(image, size.width, size.height), 0.84);
  return blobToDataUrl(blob);
}
