export const MAX_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_DATA_URL_CHARS = 45_000;
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export function isValidCvPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 60_000) {
    return false;
  }
  return (
    value.startsWith('data:image/jpeg;base64,') ||
    value.startsWith('data:image/png;base64,') ||
    value.startsWith('data:image/webp;base64,') ||
    value.startsWith('https://') ||
    value.startsWith('http://')
  );
}

function isAllowedPhotoFile(file: File): boolean {
  if ((ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return true;
  }
  if (!file.type) {
    const lowerName = file.name.toLowerCase();
    return ALLOWED_PHOTO_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  }
  return false;
}

function renderCroppedJpeg(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  width: number,
  height: number,
  quality: number,
): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function processPasFotoFile(
  file: File,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!isAllowedPhotoFile(file)) {
    return {
      ok: false,
      error: 'Format foto harus JPG, PNG, atau WEBP.',
    };
  }

  if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
    return {
      ok: false,
      error: 'Ukuran berkas foto maksimal 5 MB.',
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Gagal memuat berkas gambar.'));
      image.src = objectUrl;
    });

    if (!img.naturalWidth || !img.naturalHeight) {
      return {
        ok: false,
        error: 'Dimensi gambar tidak dapat dibaca.',
      };
    }

    const targetAspect = 3 / 4;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;

    if (imgAspect > targetAspect) {
      sw = Math.round(img.naturalHeight * targetAspect);
      sx = Math.max(0, Math.round((img.naturalWidth - sw) / 2));
    } else if (imgAspect < targetAspect) {
      sh = Math.round(img.naturalWidth / targetAspect);
      sy = Math.max(0, Math.round((img.naturalHeight - sh) * 0.2));
    }

    for (const quality of [0.84, 0.74, 0.64, 0.54]) {
      const candidate = renderCroppedJpeg(img, sx, sy, sw, sh, 270, 360, quality);
      if (!candidate) {
        return {
          ok: false,
          error: 'Browser tidak mendukung pemrosesan gambar kanvas.',
        };
      }
      if (candidate.length <= MAX_PHOTO_DATA_URL_CHARS) {
        return { ok: true, dataUrl: candidate };
      }
    }

    const fallback = renderCroppedJpeg(img, sx, sy, sw, sh, 210, 280, 0.62);
    if (!fallback || fallback.length > 60_000) {
      return {
        ok: false,
        error: 'Ukuran foto masih terlalu besar setelah kompresi. Pilih gambar dengan resolusi lebih kecil.',
      };
    }

    return { ok: true, dataUrl: fallback };
  } catch {
    return {
      ok: false,
      error: 'Gagal membaca foto. Pastikan file JPG, PNG, atau WEBP tidak rusak.',
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
