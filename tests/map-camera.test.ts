import test from "node:test";
import assert from "node:assert/strict";
import {
  initialCamera,
  panCamera,
  zoomCamera,
  constrainCamera,
  fitCamera,
  worldSize,
} from "../lib/map-camera.ts";

test("map panning stays within the drawn world at desktop and mobile sizes", () => {
  for (const size of [
    { width: 690, height: 440 },
    { width: 350, height: 390 },
  ]) {
    for (const delta of [-10000, 10000]) {
      const camera = panCamera(
        { ...initialCamera, zoom: 2 },
        size,
        delta,
        delta,
      );
      const side = worldSize(size) * camera.zoom;
      assert.ok(camera.x * side >= size.width / 2 - 0.00001);
      assert.ok((1 - camera.x) * side >= size.width / 2 - 0.00001);
      assert.ok(camera.y * side >= size.height / 2 - 0.00001);
      assert.ok((1 - camera.y) * side >= size.height / 2 - 0.00001);
    }
    assert.equal(constrainCamera({ ...initialCamera, zoom: 9 }, size).zoom, 3);
    assert.equal(constrainCamera({ ...initialCamera, zoom: 0 }, size).zoom, 1);
  }
});

test("zoom preserves the map point under a pointer and reset is reversible", () => {
  const size = { width: 600, height: 500 },
    anchor = { x: 420, y: 270 };
  const original = { ...initialCamera, zoom: 1.5 },
    next = zoomCamera(original, size, 2, anchor);
  const at = (camera: typeof initialCamera) => ({
    x: camera.x + (anchor.x - size.width / 2) / (600 * camera.zoom),
    y: camera.y + (anchor.y - size.height / 2) / (600 * camera.zoom),
  });
  assert.ok(Math.abs(at(original).x - at(next).x) < 1e-10);
  assert.ok(Math.abs(at(original).y - at(next).y) < 1e-10);
  const back = zoomCamera(next, size, 1.5, anchor);
  assert.ok(Math.abs(back.x - original.x) < 1e-10);
});

test("fit brings all filtered event markers inside the viewport", () => {
  const points = [
    { x: 0.48, y: 0.57 },
    { x: 0.65, y: 0.77 },
    { x: 0.79, y: 0.38 },
    { x: 0.38, y: 0.35 },
  ];
  for (const size of [
    { width: 690, height: 440 },
    { width: 350, height: 390 },
  ]) {
    const camera = fitCamera(points, size),
      side = worldSize(size) * camera.zoom;
    for (const p of points) {
      const x = (p.x - camera.x) * side + size.width / 2,
        y = (p.y - camera.y) * side + size.height / 2;
      assert.ok(x > 20 && x < size.width - 20);
      assert.ok(y > 20 && y < size.height - 20);
    }
  }
  assert.deepEqual(fitCamera([], { width: 400, height: 400 }), initialCamera);
});
