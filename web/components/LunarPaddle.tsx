import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GameEngine } from "../game/engine";

interface LunarPaddleProps {
  engine: GameEngine | null;
  reducedMotion: boolean;
}

type Point = readonly [number, number];

// The model is authored at 2.4 × 0.25, then scaled to the live collider.
// Its chamfers are included in those dimensions, rather than added outside them.
const HULL: Point[] = [
  [-1.184, -0.035],
  [-1.075, -0.104],
  [-0.77, -0.112],
  [-0.37, -0.083],
  [0.37, -0.083],
  [0.77, -0.112],
  [1.075, -0.104],
  [1.184, -0.035],
  [1.156, 0.073],
  [1.05, 0.111],
  [-1.05, 0.111],
  [-1.156, 0.073],
];

function plate(
  points: readonly Point[],
  bottom: number,
  depth: number,
  bevel: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, bottom);
  return geometry;
}

function box(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
}

function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts, false)!;
  for (const part of parts) part.dispose();
  return geometry;
}

function capsulePoints(width: number, height: number, cut: number): Point[] {
  const x = width / 2;
  const y = height / 2;
  return [
    [-x + cut, -y],
    [x - cut, -y],
    [x, -y + cut],
    [x, y - cut],
    [x - cut, y],
    [-x + cut, y],
    [-x, y - cut],
    [-x, -y + cut],
  ];
}

function buildHardware() {
  const hull = plate(HULL, -0.067, 0.14, 0.012);
  const seam = plate(
    HULL.map(([x, y]) => [x * 0.996, y * 0.97] as Point),
    -0.036,
    0.012,
    0.01,
  );
  const deck = plate(
    [
      [-0.85, -0.078],
      [-0.63, -0.09],
      [-0.31, -0.066],
      [0.31, -0.066],
      [0.63, -0.09],
      [0.85, -0.078],
      [0.9, 0.053],
      [0.82, 0.086],
      [-0.82, 0.086],
      [-0.9, 0.053],
    ],
    0.083,
    0.041,
    0.009,
  );
  const slotRim = plate(capsulePoints(1.53, 0.089, 0.029), 0.126, 0.011, 0.004);
  const slotWell = plate(capsulePoints(1.482, 0.065, 0.022), 0.139, 0.004, 0);
  const core = plate(capsulePoints(1.42, 0.027, 0.011), 0.144, 0.006, 0.003);
  const frontLip = plate(
    [
      [-1.08, 0.088],
      [1.08, 0.088],
      [1.13, 0.066],
      [1.13, 0.083],
      [1.037, 0.117],
      [-1.037, 0.117],
      [-1.13, 0.083],
      [-1.13, 0.066],
    ],
    0.055,
    0.024,
    0.005,
  );

  const caps: THREE.BufferGeometry[] = [];
  const capInsets: THREE.BufferGeometry[] = [];
  const vents: THREE.BufferGeometry[] = [];
  const screws: THREE.BufferGeometry[] = [];
  const screwSockets: THREE.BufferGeometry[] = [];
  const lamps: THREE.BufferGeometry[] = [];
  const runners: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const x = side * 1.015;
    caps.push(
      plate(capsulePoints(0.258, 0.146, 0.031), 0.076, 0.061, 0.009).translate(
        x,
        -0.008,
        0,
      ),
    );
    capInsets.push(
      plate(capsulePoints(0.194, 0.102, 0.02), 0.142, 0.007, 0.003).translate(
        x,
        -0.008,
        0,
      ),
    );
    runners.push(box(0.26, 0.09, 0.028, side * 0.97, -0.012, -0.093));
    // Recessed transverse slots read as a machined heat exchanger.
    for (let i = 0; i < 4; i++) {
      const ventX = x - 0.0525 + i * 0.035;
      vents.push(box(0.012, 0.057, 0.005, ventX, -0.005, 0.154));
    }
    for (const offset of [-0.089, 0.089]) {
      const screw = new THREE.CylinderGeometry(0.0115, 0.0115, 0.004, 10);
      screw.rotateX(Math.PI / 2).translate(x + offset, -0.043, 0.152);
      screws.push(screw);
      const socket = new THREE.CylinderGeometry(0.0048, 0.0048, 0.001, 6);
      socket.rotateX(Math.PI / 2).translate(x + offset, -0.043, 0.1545);
      screwSockets.push(socket);
    }
    lamps.push(box(0.105, 0.009, 0.015, x, -0.086, 0.1));
    lamps.push(box(0.019, 0.023, 0.004, side * 0.785, 0.005, 0.137));
  }
  // A narrow central keel and its two quiet index marks avoid a blank extrusion.
  const keel = plate(
    [
      [-0.17, -0.078],
      [0.17, -0.078],
      [0.11, -0.031],
      [-0.11, -0.031],
    ],
    0.115,
    0.027,
    0.005,
  );
  const indexMarks = join([
    box(0.072, 0.005, 0.002, 0, -0.06, 0.148),
    box(0.036, 0.005, 0.002, 0, -0.071, 0.148),
  ]);
  return {
    hull,
    seam,
    deck,
    slotRim,
    slotWell,
    core,
    frontLip,
    keel,
    indexMarks,
    caps: join(caps),
    capInsets: join(capInsets),
    vents: join(vents),
    screws: join(screws),
    screwSockets: join(screwSockets),
    lamps: join(lamps),
    runners: join(runners),
  };
}

function brushedRoughness(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = ((x * 17 + y * 131) % 23) / 23;
      const value = Math.round(178 + Math.sin(y * 2.7) * 26 + n * 18);
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 7);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** A planted, precisely tracked paddle with layered metal and a recessed core. */
export default function LunarPaddle({
  engine,
  reducedMotion,
}: LunarPaddleProps) {
  const root = useRef<THREE.Group>(null);
  const geometry = useMemo(buildHardware, []);
  const roughness = useMemo(brushedRoughness, []);
  const material = useMemo(
    () => ({
      titanium: new THREE.MeshStandardMaterial({
        color: "#536784",
        metalness: 0.86,
        roughness: 0.35,
        roughnessMap: roughness,
        envMapIntensity: 1.8,
      }),
      alloy: new THREE.MeshStandardMaterial({
        color: "#c5d5e9",
        metalness: 0.92,
        roughness: 0.23,
        roughnessMap: roughness,
        envMapIntensity: 2,
      }),
      ceramic: new THREE.MeshPhysicalMaterial({
        color: "#435775",
        metalness: 0.58,
        roughness: 0.3,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.25,
      }),
      graphite: new THREE.MeshStandardMaterial({
        color: "#050c17",
        metalness: 0.4,
        roughness: 0.53,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#98efff",
        emissive: "#39cedf",
        emissiveIntensity: 1.15,
        metalness: 0.3,
        roughness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.2,
      }),
      indicator: new THREE.MeshStandardMaterial({
        color: "#a4eefa",
        emissive: "#48dced",
        emissiveIntensity: 1.2,
        metalness: 0.22,
        roughness: 0.28,
      }),
      marks: new THREE.MeshStandardMaterial({
        color: "#c4d5df",
        metalness: 0.3,
        roughness: 0.38,
      }),
    }),
    [roughness],
  );
  const lastState = useRef<string | null>(null);

  useEffect(
    () => () => {
      Object.values(geometry).forEach((item) => item.dispose());
      Object.values(material).forEach((item) => item.dispose());
      roughness.dispose();
    },
    [geometry, material, roughness],
  );

  useFrame(() => {
    const paddle = engine?.scene.paddle;
    if (!root.current) return;
    root.current.visible = Boolean(paddle);
    if (!paddle || !engine) return;
    root.current.position.set(
      (paddle.x - 187.5) / 40,
      (333.5 - paddle.y) / 40,
      0,
    );
    root.current.scale.set(paddle.width / 96, paddle.height / 10, 1);
    // The simulation already smooths its collider; the model never lags or tilts.
    const snapshot = engine.getSnapshot();
    const state = paddle.isWide
      ? "wide"
      : snapshot.pulseReady
        ? "charged"
        : "normal";
    if (lastState.current !== state) {
      const color = paddle.isWide
        ? "#8eedd2"
        : snapshot.pulseReady
          ? "#f2c78f"
          : "#39cedf";
      material.glass.emissive.set(color);
      material.indicator.emissive.set(color);
      lastState.current = state;
    }
    // A restrained core fluctuation pauses together with the simulation.
    material.glass.emissiveIntensity = reducedMotion
      ? 1.15
      : 1.15 + snapshot.energy * 0.004 + Math.sin(engine.elapsed * 2.1) * 0.06;
  });

  return (
    <group
      name="lunar-paddle"
      ref={root}
      visible={Boolean(engine)}
      dispose={null}
    >
      <mesh
        geometry={geometry.runners}
        material={material.graphite}
        castShadow
      />
      <mesh
        geometry={geometry.hull}
        material={[material.titanium, material.alloy]}
        castShadow
        receiveShadow
      />
      <mesh geometry={geometry.seam} material={material.graphite} />
      <mesh
        geometry={geometry.deck}
        material={[material.ceramic, material.titanium]}
        castShadow
        receiveShadow
      />
      <mesh geometry={geometry.frontLip} material={material.alloy} castShadow />
      <mesh
        geometry={geometry.caps}
        material={material.alloy}
        castShadow
        receiveShadow
      />
      <mesh geometry={geometry.capInsets} material={material.titanium} />
      <mesh geometry={geometry.vents} material={material.graphite} />
      <mesh geometry={geometry.screws} material={material.alloy} />
      <mesh geometry={geometry.screwSockets} material={material.graphite} />
      <mesh geometry={geometry.slotRim} material={material.alloy} />
      <mesh geometry={geometry.slotWell} material={material.graphite} />
      <mesh geometry={geometry.core} material={material.glass} />
      <mesh geometry={geometry.keel} material={material.ceramic} />
      <mesh geometry={geometry.indexMarks} material={material.marks} />
      <mesh geometry={geometry.lamps} material={material.indicator} />
    </group>
  );
}
