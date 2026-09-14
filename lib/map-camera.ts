export type Camera = { x: number; y: number; zoom: number };
export type MapSize = { width: number; height: number };
export type MapPoint = { x: number; y: number };
export const initialCamera: Camera = { x: 0.5, y: 0.5, zoom: 1 };
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
export const worldSize = (size: MapSize) =>
  Math.max(1, size.width, size.height);

export function constrainCamera(camera: Camera, size: MapSize): Camera {
  const zoom = clamp(camera.zoom, 1, 3);
  const side = worldSize(size) * zoom;
  const halfX = size.width / side / 2,
    halfY = size.height / side / 2;
  return {
    zoom,
    x: clamp(camera.x, halfX, 1 - halfX),
    y: clamp(camera.y, halfY, 1 - halfY),
  };
}
export function panCamera(
  camera: Camera,
  size: MapSize,
  dx: number,
  dy: number,
): Camera {
  const side = worldSize(size) * camera.zoom;
  return constrainCamera(
    { ...camera, x: camera.x - dx / side, y: camera.y - dy / side },
    size,
  );
}
export function zoomCamera(
  camera: Camera,
  size: MapSize,
  zoom: number,
  anchor: MapPoint = { x: size.width / 2, y: size.height / 2 },
): Camera {
  const nextZoom = clamp(zoom, 1, 3),
    side = worldSize(size);
  // Keep the world point under the pointer fixed as the scale changes.
  return constrainCamera(
    {
      zoom: nextZoom,
      x:
        camera.x +
        ((anchor.x - size.width / 2) / side) * (1 / camera.zoom - 1 / nextZoom),
      y:
        camera.y +
        ((anchor.y - size.height / 2) / side) *
          (1 / camera.zoom - 1 / nextZoom),
    },
    size,
  );
}
export function fitCamera(points: MapPoint[], size: MapSize): Camera {
  if (!points.length) return constrainCamera(initialCamera, size);
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const side = worldSize(size);
  return constrainCamera(
    {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: Math.min(
        2,
        Math.max(
          1,
          Math.min(
            Math.max(1, size.width - 120) / Math.max(side * (maxX - minX), 1),
            Math.max(1, size.height - 150) / Math.max(side * (maxY - minY), 1),
          ),
        ),
      ),
    },
    size,
  );
}
