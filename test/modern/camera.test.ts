import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getSlopeCameraFrame, pointerToPaddleX } from "../../web/game/camera";

function slopeCamera(width: number, height: number) {
  const frame = getSlopeCameraFrame(width, height);
  const camera = new THREE.PerspectiveCamera(
    frame.fov,
    width / height,
    frame.near,
    frame.far,
  );
  camera.position.set(...frame.position);
  camera.up.set(...frame.up);
  camera.lookAt(...frame.target);
  camera.updateMatrixWorld();
  return camera;
}

function projectedWidth(camera: THREE.Camera, y: number, size = 1, z = 0.2) {
  return (
    new THREE.Vector3(size / 2, y, z).project(camera).x -
    new THREE.Vector3(-size / 2, y, z).project(camera).x
  );
}

// StudioTable housing/rails, inset feet and the legal brick-field tops.
// Elevated brick corners do not exist over the near apron.
function tableHullPoints() {
  const housing = [-5.25, 5.25].flatMap((x) =>
    [-8.75, 6.65].flatMap((y) =>
      [-1.25, 0.25].map((z) => new THREE.Vector3(x, y, z)),
    ),
  );
  const feet = [-4.4, 4.4].flatMap((x) =>
    [-7.9, 5.9].map((y) => new THREE.Vector3(x, y, -1.66)),
  );
  const bricks = [-4.6875, 4.6875].flatMap((x) =>
    [-5.55, 6.1].map((y) => new THREE.Vector3(x, y, 0.7)),
  );
  return [...housing, ...feet, ...bricks];
}

describe("stationary centered table camera", () => {
  it.each([
    [1440, 800],
    [800, 700],
    [390, 650],
    [320, 500],
  ])("fits the raised table with margin at %i × %i", (width, height) => {
    const camera = slopeCamera(width, height);
    let largestExtent = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const corner of tableHullPoints()) {
      const point = corner.project(camera);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(0.940001);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(0.940001);
      expect(point.z).toBeGreaterThan(-1);
      expect(point.z).toBeLessThan(1);
      largestExtent = Math.max(
        largestExtent,
        Math.abs(point.x),
        Math.abs(point.y),
      );
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    // At least one edge uses the available space: fitting cannot silently
    // regress to an unnecessarily distant camera and a tiny playing field.
    expect(largestExtent).toBeCloseTo(0.94, 6);
    expect(minX + maxX).toBeCloseTo(0, 6);
    expect(minY + maxY).toBeCloseTo(0, 6);
  });

  it.each([
    [390, 650],
    [320, 500],
  ])("fills 94%% of the width on mobile at %i × %i", (width, height) => {
    const camera = slopeCamera(width, height);
    const left = new THREE.Vector3(-5.25, -8.75, 0.25).project(camera);
    const right = new THREE.Vector3(5.25, -8.75, 0.25).project(camera);
    expect((right.x - left.x) / 2).toBeCloseTo(0.94, 6);
  });

  it.each([
    [1440, 800],
    [800, 700],
    [390, 650],
    [320, 500],
  ])(
    "keeps readable ball and brick perspective at %i × %i",
    (width, height) => {
      const camera = slopeCamera(width, height);
      // Ball growth conveys depth without the near-end stretch of a close lens.
      const nearBall = projectedWidth(camera, -6.7875, 0.35, 0);
      const farBall = projectedWidth(camera, 5.5, 0.35, 0);
      expect(nearBall / farBall).toBeGreaterThan(1.3);
      expect(nearBall / farBall).toBeLessThan(1.65);

      // Depth is apparent within the brick array itself, not only between the
      // back wall and the paddle. Equal bricks are visibly larger in front.
      const frontBrick = projectedWidth(camera, 0.5);
      const backBrick = projectedWidth(camera, 5.5);
      expect(frontBrick / backBrick).toBeGreaterThan(1.1);

      const desktopCamera = slopeCamera(1440, 800);
      const desktopRatio =
        projectedWidth(desktopCamera, 0.5) / projectedWidth(desktopCamera, 5.5);
      expect(Math.abs(frontBrick / backBrick - desktopRatio)).toBeLessThan(
        0.065,
      );
    },
  );

  it.each([
    [1440, 800, 52],
    [390, 650, 62],
  ])(
    "frames %i × %i at %i degrees without sideways yaw",
    (width, height, pitch) => {
      const camera = slopeCamera(width, height);
      const direction = camera.getWorldDirection(new THREE.Vector3());
      const elevation = Math.atan2(
        -direction.z,
        Math.hypot(direction.x, direction.y),
      );
      const yaw = Math.atan2(-direction.x, direction.y);
      expect(THREE.MathUtils.radToDeg(elevation)).toBeCloseTo(pitch, 6);
      expect(THREE.MathUtils.radToDeg(yaw)).toBeCloseTo(0, 6);
      expect(camera.up.toArray()).toEqual([0, 0, 1]);
    },
  );

  it("keeps useful vertical depth in portrait", () => {
    const camera = slopeCamera(390, 650);
    const projected = tableHullPoints().map((point) => point.project(camera).y);
    const pixelHeight = (Math.max(...projected) - Math.min(...projected)) * 325;
    expect(pixelHeight).toBeGreaterThan(290);
  });

  it.each([
    [1440, 800],
    [800, 700],
    [390, 650],
  ])(
    "keeps both rails symmetric and the paddle path level at %i × %i",
    (width, height) => {
      const frame = getSlopeCameraFrame(width, height);
      const camera = slopeCamera(width, height);
      expect(frame.position[0]).toBe(0);
      expect(frame.target[0]).toBe(0);
      for (const y of [-6.7875, 0, 5.5]) {
        const left = new THREE.Vector3(-4.5, y, 0.2).project(camera);
        const center = new THREE.Vector3(0, y, 0.2).project(camera);
        const right = new THREE.Vector3(4.5, y, 0.2).project(camera);
        expect(left.x + right.x).toBeCloseTo(0, 10);
        expect(center.x).toBeCloseTo(0, 10);
        expect(left.y).toBeCloseTo(right.y, 10);
        expect(left.z).toBeCloseTo(right.z, 10);
      }
    },
  );

  it.each([0.72, 1.45])(
    "moves continuously across the %s aspect breakpoint",
    (aspect) => {
      const before = slopeCamera((aspect - 0.00001) * 1000, 1000);
      const after = slopeCamera((aspect + 0.00001) * 1000, 1000);
      expect(before.position.distanceTo(after.position)).toBeLessThan(0.0001);
      expect(before.quaternion.angleTo(after.quaternion)).toBeLessThan(0.0001);
      expect(Math.abs(before.fov - after.fov)).toBeLessThan(0.01);
    },
  );
});

describe("perspective paddle controls", () => {
  it.each([
    [1440, 800],
    [800, 700],
    [390, 650],
    [320, 500],
  ])("maps projected paddle positions exactly at %i × %i", (width, height) => {
    const camera = slopeCamera(width, height);
    const paddleY = -6.7875;
    for (const gameX of [0, 60, 187.5, 290, 375]) {
      const point = new THREE.Vector3(
        (gameX - 187.5) / 40,
        paddleY,
        0.12,
      ).project(camera);
      expect(pointerToPaddleX(point.x, camera, paddleY)).toBeCloseTo(gameX, 6);
    }
    expect(pointerToPaddleX(-10, camera, paddleY)).toBe(0);
    expect(pointerToPaddleX(10, camera, paddleY)).toBe(375);
  });

  it("keeps horizontal motion accurate while the camera is offset", () => {
    const camera = slopeCamera(800, 700);
    camera.position.x += 0.4;
    camera.lookAt(...getSlopeCameraFrame(800, 700).target);
    camera.updateMatrixWorld();
    for (const gameX of [0, 100, 187.5, 260, 375]) {
      const point = new THREE.Vector3(
        (gameX - 187.5) / 40,
        -6.7875,
        0.3,
      ).project(camera);
      expect(pointerToPaddleX(point.x, camera, -6.7875, 0.3)).toBeCloseTo(
        gameX,
        6,
      );
    }
  });
});
