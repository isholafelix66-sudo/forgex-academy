export type CropSource = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/**
 * Return the source rectangle for a centred square crop.
 * Offsets are fractions of the crop size, making the controls intuitive and
 * keeping the crop inside the original image at every zoom level.
 */
export function getSquareCropSource(
  width: number,
  height: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): CropSource {
  const safeZoom = Math.min(4, Math.max(1, zoom));
  const size = Math.min(width, height) / safeZoom;
  const maxX = Math.max(0, width - size);
  const maxY = Math.max(0, height - size);
  const safeX = Math.min(1, Math.max(-1, offsetX));
  const safeY = Math.min(1, Math.max(-1, offsetY));
  return {
    sx: Math.max(0, Math.min(maxX, (width - size) / 2 + safeX * size)),
    sy: Math.max(0, Math.min(maxY, (height - size) / 2 + safeY * size)),
    sw: size,
    sh: size,
  };
}
