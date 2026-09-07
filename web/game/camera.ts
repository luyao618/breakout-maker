import * as THREE from "three";

interface CameraFrame {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

const HALF_PLAYFIELD_WIDTH = 375 / 2 / 40;
const DESKTOP_ELEVATION = THREE.MathUtils.degToRad(52);
const PORTRAIT_ELEVATION = THREE.MathUtils.degToRad(62);
const DESKTOP_ORIGIN_DISTANCE = 18.5;
const PORTRAIT_ORIGIN_DISTANCE = 20.5;
const FRAME_LIMIT = 0.94;

/** Frame a centered, stationary table with comfortable perspective. */
export function getSlopeCameraFrame(
  width: number,
  height: number,
): CameraFrame {
  const aspect =
    (Number.isFinite(width) && width > 0 ? width : 1) /
    (Number.isFinite(height) && height > 0 ? height : 1);
  // Raise the lens in portrait so the table retains usable visual depth.
  // Smooth interpolation avoids a camera jump when rotating or resizing.
  const portraitBlend = 1 - THREE.MathUtils.smoothstep(aspect, 0.72, 1.45);
  const elevation = THREE.MathUtils.lerp(
    DESKTOP_ELEVATION,
    PORTRAIT_ELEVATION,
    portraitBlend,
  );
  const originDistance = THREE.MathUtils.lerp(
    DESKTOP_ORIGIN_DISTANCE,
    PORTRAIT_ORIGIN_DISTANCE,
    portraitBlend,
  );
  const backward = new THREE.Vector3(
    0,
    -Math.cos(elevation),
    Math.sin(elevation),
  );
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(backward, right);
  // Fit the real silhouette: elevated bricks do not extend over the front
  // apron, and the feet sit inside the housing. A single bounding box adds
  // imaginary tall front corners that make the close portrait lens zoom out.
  const hull = [
    { x: [-5.25, 5.25], y: [-8.75, 6.65], z: [-1.25, 0.25] },
    { x: [-4.4, 4.4], y: [-7.9, 5.9], z: [-1.66] },
    { x: [-4.6875, 4.6875], y: [-5.55, 6.1], z: [0.7] },
  ];
  const corners = hull.flatMap(({ x: xs, y: ys, z: zs }) =>
    xs.flatMap((x) =>
      ys.flatMap((y) =>
        zs.map((z) => {
          const corner = new THREE.Vector3(x, y, z);
          return {
            horizontal: corner.dot(right),
            vertical: corner.dot(up),
            depth: -corner.dot(backward),
          };
        }),
      ),
    ),
  );

  // A moderate physical distance keeps the near end readable without a
  // wide-angle stretch. Center the perspective silhouette vertically; exact
  // horizontal symmetry gives the paddle a level, stable path on screen.
  function centeredVerticalOffset() {
    let low = Math.min(...corners.map((corner) => corner.vertical));
    let high = Math.max(...corners.map((corner) => corner.vertical));
    for (let step = 0; step < 40; step++) {
      const offset = (low + high) / 2;
      const projected = corners.map(
        (corner) =>
          (corner.vertical - offset) / (originDistance + corner.depth),
      );
      if (Math.min(...projected) + Math.max(...projected) > 0) low = offset;
      else high = offset;
    }
    return (low + high) / 2;
  }
  const verticalOffset = centeredVerticalOffset();
  const horizontalSpan = Math.max(
    ...corners.map((corner) =>
      Math.abs(corner.horizontal / (originDistance + corner.depth)),
    ),
  );
  const verticalSpan = Math.max(
    ...corners.map((corner) =>
      Math.abs(
        (corner.vertical - verticalOffset) / (originDistance + corner.depth),
      ),
    ),
  );
  const fittedSpan =
    Math.max(verticalSpan, horizontalSpan / aspect) / FRAME_LIMIT;
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(fittedSpan));
  const position = backward
    .clone()
    .multiplyScalar(originDistance)
    .addScaledVector(up, verticalOffset);
  const distance = position.z / backward.z;
  const target = position.clone().addScaledVector(backward, -distance);

  return {
    position: [position.x, position.y, position.z],
    target: [target.x, target.y, 0],
    up: [0, 0, 1],
    fov,
    near: 0.1,
    far: Math.max(150, distance + 50),
  };
}

/**
 * Map screen X to the paddle's horizontal path, independent of pointer Y.
 * A floor-ray intersection would make vertical finger motion steer the paddle
 * sideways under perspective. Projecting its fixed-depth path avoids that.
 */
export function pointerToPaddleX(
  ndcX: number,
  camera: THREE.Camera,
  paddleWorldY: number,
  paddleWorldZ = 0.12,
): number {
  const left = new THREE.Vector4(
    -HALF_PLAYFIELD_WIDTH,
    paddleWorldY,
    paddleWorldZ,
    1,
  )
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix);
  const right = new THREE.Vector4(
    HALF_PLAYFIELD_WIDTH,
    paddleWorldY,
    paddleWorldZ,
    1,
  )
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix);
  const leftX = left.x / left.w;
  const rightX = right.x / right.w;
  const span = rightX - leftX;
  if (!Number.isFinite(ndcX) || !Number.isFinite(span) || Math.abs(span) < 1e-8)
    return 375 / 2;

  const screenFraction = THREE.MathUtils.clamp((ndcX - leftX) / span, 0, 1);
  // Perspective-correct interpolation also supports callers with endpoints
  // at different camera-space depths.
  const worldFraction =
    (screenFraction * left.w) /
    ((1 - screenFraction) * right.w + screenFraction * left.w);
  return THREE.MathUtils.clamp(worldFraction * 375, 0, 375);
}
