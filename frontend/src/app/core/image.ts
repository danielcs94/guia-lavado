const MAX_SIDE = 1568;

/**
 * Reduce la foto antes de subirla y la convierte a JPEG (así también funcionan
 * las fotos HEIC del iPhone). Si el navegador no puede decodificarla, se sube tal cual.
 */
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.85));
}

const THUMB_SIDE = 160;

/**
 * Miniatura cuadrada en data URL para reconocer cada prenda en la lista.
 */
export async function thumbnail(file: Blob): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIDE;
  canvas.height = THUMB_SIDE;
  canvas
    .getContext('2d')!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, THUMB_SIDE, THUMB_SIDE);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.7);
}
