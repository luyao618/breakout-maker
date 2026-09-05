import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { GameEngine } from "./game/engine";
import {
  ArcadeBloom,
  ReactorField,
  ImpactEffects,
  PowerAuras,
} from "./effects/ArcadeEffects";

interface ArenaProps {
  engine: GameEngine | null;
  variant: "showcase" | "play";
  quality: "high" | "low";
  reducedMotion: boolean;
  onMove?: (x: number) => void;
  onLaunch?: () => void;
  onReady?: () => void;
}

interface BrickView {
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  color?: string | string[] | null;
  shakeTimer: number;
}
interface FieldView {
  bricks: (BrickView | null)[][];
  getBrickRect: (
    row: number,
    col: number,
  ) => { x: number; y: number; w: number; h: number };
}
interface SceneView {
  brickField: FieldView | null;
  paddle: {
    x: number;
    y: number;
    width: number;
    height: number;
    isWide: boolean;
  } | null;
  balls: {
    x: number;
    y: number;
    radius: number;
    isFireball: boolean;
    trail: { x: number; y: number }[];
  }[];
  particles: {
    x: number;
    y: number;
    size: number;
    alpha: number;
    color: string;
    life: number;
  }[];
  powerUpDrops: {
    x: number;
    y: number;
    alive: boolean;
    rotation: number;
    type: string;
  }[];
}

const COLORS = {
  lavender: "#b7a1ff",
  cyan: "#8ee7f0",
  peach: "#f8b78c",
  white: "#f6f4ff",
  metal: "#73758d",
};
const MAX_BRICKS = 2560;
const MAX_BALLS = 256;
const MAX_PARTICLES = 2048;
const MAX_DROPS = 256;
const POWER_GLYPHS: Record<string, string> = {
  split: "÷",
  multiShot: "⇑",
  fireball: "★",
  widePaddle: "↔",
  extraLife: "+",
};
const xWorld = (x: number) => (x - 187.5) / 40;
const yWorld = (y: number) => (333.5 - y) / 40;

/** An orthographic camera keeps the original collision plane readable at every size. */
function CameraRig({
  variant,
  engine,
  reducedMotion,
}: Pick<ArenaProps, "variant" | "engine" | "reducedMotion">) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    if (variant === "showcase") {
      cam.position.set(9, -12, 20);
      cam.lookAt(0, 0.4, 0);
      cam.zoom = Math.min(size.width / 13.2, size.height / 12.2);
    } else {
      cam.position.set(0, -4.8, 32);
      cam.lookAt(0, -1, 0);
      cam.zoom = Math.min(size.width / 10.3, size.height / 15.7);
    }
    cam.updateProjectionMatrix();
  }, [camera, size, variant]);
  useFrame(() => {
    if (variant !== "play" || !engine) return;
    let impulse = 0;
    if (!reducedMotion)
      for (const event of engine.feedback) {
        const age = engine.elapsed - event.time;
        if (
          age >= 0 &&
          age < 0.35 &&
          ["pulse", "powerCollect", "brick"].includes(event.kind)
        ) {
          impulse +=
            (event.kind === "pulse"
              ? 0.065
              : event.kind === "powerCollect"
                ? 0.018
                : 0.006) * Math.pow(1 - age / 0.35, 2);
        }
      }
    camera.position.x =
      Math.sin(engine.elapsed * 91) * Math.min(0.075, impulse);
    camera.position.y =
      -4.8 + Math.cos(engine.elapsed * 73) * Math.min(0.035, impulse);
    camera.lookAt(0, -1, 0);
  });
  return null;
}

function StudioLighting({ quality }: Pick<ArenaProps, "quality">) {
  return (
    <>
      <ambientLight intensity={0.52} color="#c3c3ef" />
      <directionalLight
        position={[-7, 8, 12]}
        intensity={2.0}
        color="#f6e5ff"
        castShadow={quality === "high"}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-normalBias={0.045}
      />
      <pointLight
        position={[6, 0, 6]}
        intensity={48}
        color={COLORS.cyan}
        distance={24}
        decay={2}
      />
      <pointLight
        position={[-6, -5, 3]}
        intensity={36}
        color={COLORS.peach}
        distance={20}
        decay={2}
      />
      <Suspense fallback={null}>
        <Environment resolution={quality === "high" ? 128 : 64} frames={1}>
          <Lightformer
            form="rect"
            intensity={1.6}
            color="#e9e4ff"
            scale={[9, 6, 1]}
            position={[-5, 5, 8]}
            rotation={[0, -0.4, -0.3]}
          />
          <Lightformer
            form="rect"
            intensity={1.3}
            color={COLORS.cyan}
            scale={[3, 9, 1]}
            position={[7, 0, 5]}
            rotation={[0, -0.7, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.6}
            color={COLORS.peach}
            scale={[5, 2, 1]}
            position={[0, -8, 4]}
            rotation={[0.7, 0, 0]}
          />
        </Environment>
      </Suspense>
    </>
  );
}

function Beveled({
  size,
  position,
  color,
  metalness = 0.3,
  roughness = 0.28,
  emission = 0,
  radius = 0.075,
  reflection = 0.6,
}: {
  size: [number, number, number];
  position?: [number, number, number];
  color: string;
  metalness?: number;
  roughness?: number;
  emission?: number;
  radius?: number;
  reflection?: number;
}) {
  const geometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        ...size,
        2,
        Math.min(radius, ...size.map((v) => v / 2)),
      ),
    [size[0], size[1], size[2], radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={position} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        envMapIntensity={reflection}
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={color}
        emissiveIntensity={emission}
      />
    </mesh>
  );
}

function TechnicalGrid({
  width,
  height,
  centerY = 0,
}: {
  width: number;
  height: number;
  centerY?: number;
}) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (let x = -width / 2; x <= width / 2; x += 0.5)
      points.push(
        x,
        -height / 2 + centerY,
        -0.16,
        x,
        height / 2 + centerY,
        -0.16,
      );
    for (let y = -height / 2; y <= height / 2; y += 0.5)
      points.push(
        -width / 2,
        y + centerY,
        -0.16,
        width / 2,
        y + centerY,
        -0.16,
      );
    return new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
  }, [width, height, centerY]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#9597bd"
        transparent
        opacity={0.09}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function Screw({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.035, 16]} />
        <meshStandardMaterial
          color="#aaaabc"
          metalness={0.92}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0, 0.021]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.065, 0.011, 0.006]} />
        <meshBasicMaterial color="#292838" />
      </mesh>
    </group>
  );
}

/** Machined rails and fasteners make the game board an object, not a flat overlay. */
function Chassis({ showcase }: { showcase: boolean }) {
  const width = showcase ? 8.6 : 9.55;
  const height = showcase ? 10.2 : 14.85;
  const cy = showcase ? 0 : -1;
  const ticks = useMemo(
    () => Array.from({ length: showcase ? 19 : 29 }, (_, i) => i),
    [showcase],
  );
  return (
    <group>
      <Beveled
        size={[width + 0.27, height + 0.27, 0.24]}
        position={[0, cy, -0.4]}
        color="#414158"
        metalness={0.85}
        roughness={0.27}
        radius={0.16}
      />
      <Beveled
        size={[width, height, 0.22]}
        position={[0, cy, -0.29]}
        color="#15182d"
        metalness={0.16}
        roughness={0.64}
        radius={0.12}
        reflection={0.08}
      />
      <TechnicalGrid width={width - 0.25} height={height - 0.25} centerY={cy} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Beveled
            size={[0.1, height - 0.26, 0.16]}
            position={[side * (width / 2 - 0.06), cy, -0.08]}
            color="#a5a8c1"
            metalness={0.88}
            roughness={0.22}
            radius={0.035}
          />
          <mesh position={[side * (width / 2 - 0.14), cy, 0.005]}>
            <boxGeometry args={[0.025, height - 0.7, 0.02]} />
            <meshBasicMaterial
              color={side === -1 ? COLORS.lavender : COLORS.cyan}
              transparent
              opacity={0.65}
            />
          </mesh>
          {ticks.map((i) => (
            <mesh
              key={i}
              position={[
                side * (width / 2 + 0.038),
                cy + (i - (ticks.length - 1) / 2) * 0.48,
                -0.23,
              ]}
            >
              <boxGeometry args={[i % 5 === 0 ? 0.095 : 0.043, 0.018, 0.008]} />
              <meshBasicMaterial color="#b8bad0" transparent opacity={0.52} />
            </mesh>
          ))}
          {[-1, 1].map((end) => (
            <Screw
              key={end}
              position={[
                side * (width / 2 - 0.09),
                cy + end * (height / 2 - 0.1),
                -0.03,
              ]}
            />
          ))}
        </group>
      ))}
      <Beveled
        size={[width - 0.2, 0.09, 0.15]}
        position={[0, cy + height / 2 - 0.06, -0.07]}
        color="#b1b3ce"
        metalness={0.82}
        roughness={0.22}
        radius={0.03}
      />
      <mesh position={[0, cy - height / 2 + 0.35, -0.13]}>
        <boxGeometry args={[0.95, 0.025, 0.012]} />
        <meshBasicMaterial color={COLORS.lavender} transparent opacity={0.36} />
      </mesh>
      {showcase && (
        <>
          <Beveled
            size={[0.8, 0.18, 0.2]}
            position={[-3.2, -5.23, -0.27]}
            color="#747489"
            metalness={0.85}
          />
          <Beveled
            size={[0.8, 0.18, 0.2]}
            position={[3.2, -5.23, -0.27]}
            color="#747489"
            metalness={0.85}
          />
        </>
      )}
    </group>
  );
}

function Orbit({
  radius,
  tilt,
  opacity,
  color,
}: {
  radius: number;
  tilt: [number, number, number];
  opacity: number;
  color: string;
}) {
  return (
    <group rotation={tilt}>
      <mesh>
        <torusGeometry args={[radius, 0.012, 6, 180]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[0.065, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function AmbientMotes({ reducedMotion }: Pick<ArenaProps, "reducedMotion">) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(95 * 3);
    for (let i = 0; i < 95; i++) {
      const angle = i * 2.399963;
      const distance = 5.5 + ((i * 37) % 53) / 10;
      positions[i * 3] = Math.cos(angle) * distance;
      positions[i * 3 + 1] = Math.sin(angle) * distance;
      positions[i * 3 + 2] = -3 + ((i * 17) % 43) / 10;
    }
    return new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (ref.current && !reducedMotion)
      ref.current.rotation.z = clock.elapsedTime * 0.009;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#d4c7ff"
        size={0.035}
        transparent
        opacity={0.57}
        sizeAttenuation
      />
    </points>
  );
}

function HeroBall({ reducedMotion }: Pick<ArenaProps, "reducedMotion">) {
  const group = useRef<THREE.Group>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const temp = useMemo(() => new THREE.Object3D(), []);
  const path = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.7, -3.65, 0.18),
        new THREE.Vector3(-0.6, -2.1, 0.35),
        new THREE.Vector3(1.5, 0.3, 0.8),
        new THREE.Vector3(2.8, 2.3, 0.6),
        new THREE.Vector3(0.8, 0.5, 0.38),
        new THREE.Vector3(-1.7, -3.65, 0.18),
      ]),
    [],
  );
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = reducedMotion ? 0.35 : (clock.elapsedTime * 0.08 + 0.35) % 1;
    if (group.current) group.current.position.copy(path.getPoint(t, point));
    if (trail.current) {
      for (let i = 0; i < 28; i++) {
        path.getPoint((t - i * 0.0025 + 1) % 1, point);
        temp.position.copy(point);
        temp.scale.setScalar(0.1 * (1 - i / 30));
        temp.updateMatrix();
        trail.current.setMatrixAt(i, temp.matrix);
      }
      trail.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[0.145, 24, 24]} />
          <meshStandardMaterial
            color="#fff6e3"
            emissive="#fff0d8"
            emissiveIntensity={2}
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>
        <pointLight color="#ead8ff" intensity={2.5} distance={3.5} />
      </group>
      <instancedMesh
        ref={trail}
        args={[undefined, undefined, 28]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color="#e4d2ff"
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}

function Showcase({ reducedMotion }: Pick<ArenaProps, "reducedMotion">) {
  const sculpture = useRef<THREE.Group>(null);
  const fragments = useRef<THREE.Group>(null);
  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    initialX: 0,
    initialY: 0,
  });
  const { size } = useThree();
  const bricks = useMemo(() => {
    const cells: {
      x: number;
      y: number;
      z: number;
      color: string;
      height: number;
    }[] = [];
    const palette = [
      "#de956d",
      "#d893b4",
      "#a18ad9",
      "#9573e0",
      "#70a2cd",
      "#64bdcc",
    ];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 8; col++) {
        if (
          (row === 0 && (col === 0 || col > 5)) ||
          (row === 5 && (col < 2 || col > 5)) ||
          (row === 4 && col === 7)
        )
          continue;
        const cascade = Math.max(0, 2.5 - Math.abs(col - 3.2) - row * 0.28);
        cells.push({
          x: (col - 3.5) * 0.91,
          y: 3.98 - row * 0.86,
          z: 0.12 + cascade * 0.18,
          height: 0.38 + cascade * 0.17,
          color: palette[row],
        });
      }
    }
    return cells;
  }, []);
  useFrame(({ clock, pointer }) => {
    if (sculpture.current) {
      const t = reducedMotion ? 0 : clock.elapsedTime;
      sculpture.current.position.y = 0.15 + Math.sin(t * 0.58) * 0.095;
      sculpture.current.rotation.z =
        -0.38 + (reducedMotion ? 0 : Math.sin(t * 0.32) * 0.018);
      sculpture.current.rotation.y = THREE.MathUtils.lerp(
        sculpture.current.rotation.y,
        drag.current.x + (reducedMotion ? 0 : pointer.x * 0.035),
        0.12,
      );
      sculpture.current.rotation.x = THREE.MathUtils.lerp(
        sculpture.current.rotation.x,
        drag.current.y,
        0.12,
      );
    }
    if (fragments.current && !reducedMotion)
      fragments.current.rotation.z = Math.sin(clock.elapsedTime * 0.18) * 0.045;
  });
  return (
    <>
      <AmbientMotes reducedMotion={reducedMotion} />
      <group position={[0, 0, -0.85]}>
        <Orbit
          radius={6.4}
          tilt={[0.18, 0.38, 0.3]}
          opacity={0.2}
          color={COLORS.lavender}
        />
        <Orbit
          radius={6.85}
          tilt={[-0.42, -0.2, -0.32]}
          opacity={0.13}
          color={COLORS.cyan}
        />
      </group>
      <group
        ref={sculpture}
        rotation={[0, 0, -0.38]}
        onPointerDown={(event) => {
          event.stopPropagation();
          drag.current.active = true;
          drag.current.startX = event.clientX;
          drag.current.startY = event.clientY;
          drag.current.initialX = drag.current.x;
          drag.current.initialY = drag.current.y;
          (
            event.target as unknown as {
              setPointerCapture: (id: number) => void;
            }
          ).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          drag.current.x = THREE.MathUtils.clamp(
            drag.current.initialX +
              ((event.clientX - drag.current.startX) / size.width) * 0.8,
            -0.35,
            0.35,
          );
          drag.current.y = THREE.MathUtils.clamp(
            drag.current.initialY +
              ((event.clientY - drag.current.startY) / size.height) * 0.6,
            -0.22,
            0.22,
          );
        }}
        onPointerUp={(event) => {
          drag.current.active = false;
          (
            event.target as unknown as {
              releasePointerCapture: (id: number) => void;
            }
          ).releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current.active = false;
        }}
      >
        <Chassis showcase />
        {bricks.map((brick, i) => (
          <group key={i}>
            <Beveled
              size={[0.82, 0.77, brick.height]}
              position={[brick.x, brick.y, brick.z]}
              color={brick.color}
              metalness={0.22}
              roughness={0.27}
              emission={0.07}
              reflection={0.4}
              radius={0.075}
            />
            <mesh
              position={[
                brick.x,
                brick.y - 0.22,
                brick.z + brick.height / 2 + 0.001,
              ]}
            >
              <boxGeometry args={[0.47, 0.013, 0.007]} />
              <meshBasicMaterial color="#fff5ff" transparent opacity={0.3} />
            </mesh>
          </group>
        ))}
        <group position={[-1.7, -3.86, 0.13]}>
          <Beveled
            size={[2.55, 0.28, 0.34]}
            color={COLORS.peach}
            metalness={0.76}
            roughness={0.18}
            radius={0.12}
          />
          <mesh position={[0, 0.035, 0.175]}>
            <boxGeometry args={[1.5, 0.045, 0.01]} />
            <meshBasicMaterial color="#fff7ed" />
          </mesh>
          {[-1, 1].map((side) => (
            <Beveled
              key={side}
              size={[0.2, 0.32, 0.36]}
              position={[side * 1.08, 0, 0]}
              color="#565167"
              metalness={0.9}
              roughness={0.17}
              radius={0.045}
            />
          ))}
        </group>
        <HeroBall reducedMotion={reducedMotion} />
        <group ref={fragments}>
          <group position={[4.5, 3.4, 0.8]} rotation={[0.2, 0.3, 0.22]}>
            <Beveled
              size={[0.65, 0.65, 0.6]}
              color={COLORS.peach}
              metalness={0.5}
              emission={0.1}
            />
          </group>
          <group position={[-4.9, -0.8, 0.8]} rotation={[0.4, 0.6, 0.2]}>
            <Beveled
              size={[0.45, 0.45, 0.45]}
              color={COLORS.lavender}
              metalness={0.5}
              emission={0.13}
            />
          </group>
          <group position={[4.8, -2.5, 1]} rotation={[0.4, 0.2, 0.7]}>
            <Beveled
              size={[0.3, 0.3, 0.3]}
              color={COLORS.cyan}
              metalness={0.6}
              emission={0.15}
            />
          </group>
        </group>
      </group>
    </>
  );
}

function brickColor(brick: BrickView): string {
  // Uploaded image pixels retain their exact color; old gradient presets use the new material palette.
  if (typeof brick.color === "string") return brick.color;
  if (
    Array.isArray(brick.color) &&
    !["#6a5e88", "#d4623a", "#e8b84a", "#3e3e50"].includes(brick.color[0])
  )
    return brick.color[0];
  if (brick.maxHp >= 10) return "#8b94aa";
  if (brick.maxHp >= 3) return COLORS.peach;
  if (brick.maxHp >= 2) return COLORS.cyan;
  return ["#8b6dff", "#6f94ff", "#60c2ff", "#72e6ec"][brick.row % 4];
}

function DropLabelLayer({
  engine,
  type,
  glyph,
  capacity,
}: {
  engine: GameEngine | null;
  type: string;
  glyph: string;
  capacity: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d")!;
    context.font = "bold 80px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.strokeStyle = "#f6f4ff";
    context.lineWidth = 5;
    context.strokeText(glyph, 48, 50);
    context.fillStyle = "#18192b";
    context.fillText(glyph, 48, 50);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [glyph]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (!mesh.current) return;
    const scene = engine?.scene as SceneView | undefined;
    let count = 0;
    for (const drop of scene?.powerUpDrops ?? []) {
      if (!drop.alive || drop.type !== type || count >= capacity) continue;
      scratch.position.set(xWorld(drop.x), yWorld(drop.y), 0.57);
      scratch.updateMatrix();
      mesh.current.setMatrixAt(count++, scratch.matrix);
    }
    mesh.current.count = count;
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, capacity]}
      count={0}
      frustumCulled={false}
    >
      <planeGeometry args={[0.25, 0.25]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </instancedMesh>
  );
}

function Playfield({
  engine,
  reducedMotion,
  onMove,
  onLaunch,
}: Pick<ArenaProps, "engine" | "reducedMotion" | "onMove" | "onLaunch">) {
  const brickCapacity = Math.max(1, engine?.level.bricks.length ?? MAX_BRICKS);
  const [ballCapacity, setBallCapacity] = useState(MAX_BALLS);
  const [dropCapacity, setDropCapacity] = useState(MAX_DROPS);
  const bricks = useRef<THREE.InstancedMesh>(null);
  const cores = useRef<THREE.InstancedMesh>(null);
  const balls = useRef<THREE.InstancedMesh>(null);
  const trails = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<THREE.InstancedMesh>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const paddle = useRef<THREE.Group>(null);
  const paddleMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 1, 0.08),
    [],
  );
  const scratch = useMemo(
    () => ({
      object: new THREE.Object3D(),
      color: new THREE.Color(),
      white: new THREE.Color("#f5efff"),
      field: null as FieldView | null,
      entries: [] as {
        brick: BrickView;
        x: number;
        y: number;
        w: number;
        h: number;
        color: string;
        hp: number;
      }[],
    }),
    [],
  );
  useEffect(() => () => bodyGeometry.dispose(), [bodyGeometry]);
  useFrame(({ clock }) => {
    const scene = engine?.scene as SceneView | undefined;
    if (!scene) return;
    // Only resize GPU storage when an unlimited legacy split exceeds its previous capacity.
    // Entity positions and colors stay entirely outside React state.
    if (scene.balls.length > ballCapacity)
      setBallCapacity(2 ** Math.ceil(Math.log2(scene.balls.length)));
    if (scene.powerUpDrops.length > dropCapacity)
      setDropCapacity(2 ** Math.ceil(Math.log2(scene.powerUpDrops.length)));
    const obj = scratch.object;
    if (bricks.current && scene.brickField) {
      if (scratch.field !== scene.brickField) {
        scratch.field = scene.brickField;
        scratch.entries = scene.brickField.bricks
          .flat()
          .filter((brick): brick is BrickView => !!brick)
          .slice(0, brickCapacity)
          .map((brick) => {
            const rect = scene.brickField!.getBrickRect(brick.row, brick.col);
            return {
              brick,
              x: xWorld(rect.x + rect.w / 2),
              y: yWorld(rect.y + rect.h / 2),
              w: rect.w / 40,
              h: rect.h / 40,
              color: brickColor(brick),
              hp: -1,
            };
          });
        bricks.current.count = scratch.entries.length;
        if (cores.current) cores.current.count = scratch.entries.length;
      }
      let colorChanged = false;
      scratch.entries.forEach((entry, index) => {
        const b = entry.brick;
        const depth = Math.min(0.35, Math.max(0.07, entry.w * 0.3));
        const shake =
          !reducedMotion && b.shakeTimer > 0
            ? Math.sin(clock.elapsedTime * 160) *
              Math.min(0.025, entry.w * 0.08)
            : 0;
        obj.position.set(entry.x + shake, entry.y, depth / 2);
        obj.rotation.set(0, 0, 0);
        obj.scale.set(
          b.alive ? entry.w : 0,
          b.alive ? entry.h : 0,
          b.alive ? depth : 0,
        );
        obj.updateMatrix();
        bricks.current!.setMatrixAt(index, obj.matrix);
        if (cores.current) {
          obj.position.set(
            entry.x + shake,
            entry.y - entry.h * 0.22,
            depth + 0.005,
          );
          obj.scale.set(b.alive ? entry.w * 0.65 : 0, entry.h * 0.052, 0.025);
          obj.updateMatrix();
          cores.current.setMatrixAt(index, obj.matrix);
        }
        if (entry.hp !== b.hp) {
          scratch.color.set(entry.color);
          if (b.hp < b.maxHp)
            scratch.color.lerp(scratch.white, (1 - b.hp / b.maxHp) * 0.34);
          bricks.current!.setColorAt(index, scratch.color);
          if (cores.current)
            cores.current.setColorAt(
              index,
              scratch.color.clone().multiplyScalar(2.8),
            );
          entry.hp = b.hp;
          colorChanged = true;
        }
      });
      bricks.current.instanceMatrix.needsUpdate = true;
      if (cores.current) {
        cores.current.instanceMatrix.needsUpdate = true;
        if (colorChanged && cores.current.instanceColor)
          cores.current.instanceColor.needsUpdate = true;
      }
      if (colorChanged && bricks.current.instanceColor)
        bricks.current.instanceColor.needsUpdate = true;
    }
    if (paddle.current && scene.paddle) {
      const p = scene.paddle;
      paddle.current.position.set(xWorld(p.x), yWorld(p.y), 0.12);
      paddle.current.scale.set(p.width / 40, p.height / 40, 1);
      if (paddleMaterial.current) {
        paddleMaterial.current.color.set(p.isWide ? COLORS.cyan : COLORS.peach);
        paddleMaterial.current.emissive.set(
          p.isWide ? COLORS.cyan : COLORS.peach,
        );
      }
    }
    if (balls.current && trails.current) {
      balls.current.count = Math.min(scene.balls.length, ballCapacity);
      let trailCount = 0;
      scene.balls.slice(0, ballCapacity).forEach((ball, index) => {
        obj.position.set(xWorld(ball.x), yWorld(ball.y), 0.18);
        obj.rotation.set(0, 0, 0);
        obj.scale.setScalar(ball.radius / 40);
        obj.updateMatrix();
        balls.current!.setMatrixAt(index, obj.matrix);
        scratch.color.set(ball.isFireball ? "#ff914d" : COLORS.white);
        balls.current!.setColorAt(index, scratch.color);
        if (!reducedMotion)
          ball.trail.forEach((point, trailIndex) => {
            if (trailCount >= ballCapacity * 5) return;
            obj.position.set(xWorld(point.x), yWorld(point.y), 0.14);
            obj.scale.setScalar(
              ((ball.radius / 40) * (trailIndex + 1)) / (ball.trail.length + 1),
            );
            obj.updateMatrix();
            trails.current!.setMatrixAt(trailCount, obj.matrix);
            trails.current!.setColorAt(trailCount, scratch.color);
            trailCount++;
          });
      });
      trails.current.count = trailCount;
      balls.current.instanceMatrix.needsUpdate = true;
      trails.current.instanceMatrix.needsUpdate = true;
      if (balls.current.instanceColor)
        balls.current.instanceColor.needsUpdate = true;
      if (trails.current.instanceColor)
        trails.current.instanceColor.needsUpdate = true;
    }
    if (particles.current) {
      const liveParticles = reducedMotion ? [] : scene.particles;
      particles.current.count = Math.min(liveParticles.length, MAX_PARTICLES);
      for (let i = 0; i < particles.current.count; i++) {
        const p = liveParticles[i];
        const alpha = p.alpha ?? 1;
        obj.position.set(
          xWorld(p.x),
          yWorld(p.y),
          0.15 + Math.sin(alpha * Math.PI) * 0.38,
        );
        obj.rotation.set(p.life * 4, p.life * 5, p.life * 3);
        obj.scale.setScalar((p.size / 40) * alpha * 0.85);
        obj.updateMatrix();
        particles.current.setMatrixAt(i, obj.matrix);
        scratch.color.set(p.color || COLORS.lavender).multiplyScalar(alpha);
        particles.current.setColorAt(i, scratch.color);
      }
      particles.current.instanceMatrix.needsUpdate = true;
      if (particles.current.instanceColor)
        particles.current.instanceColor.needsUpdate = true;
    }
    if (drops.current) {
      const liveDrops = scene.powerUpDrops
        .filter((d) => d.alive)
        .slice(0, dropCapacity);
      drops.current.count = liveDrops.length;
      const dropColors: Record<string, string> = {
        split: "#71f9ff",
        multiShot: "#b791ff",
        fireball: "#ff955e",
        widePaddle: "#8fffc5",
        extraLife: "#ff86b5",
      };
      liveDrops.forEach((drop, i) => {
        obj.position.set(xWorld(drop.x), yWorld(drop.y), 0.3);
        obj.rotation.set(0.4, reducedMotion ? 0 : drop.rotation, 0.4);
        obj.scale.setScalar(0.23);
        obj.updateMatrix();
        drops.current!.setMatrixAt(i, obj.matrix);
        drops.current!.setColorAt(
          i,
          scratch.color.set(dropColors[drop.type] || COLORS.cyan),
        );
      });
      drops.current.instanceMatrix.needsUpdate = true;
      if (drops.current.instanceColor)
        drops.current.instanceColor.needsUpdate = true;
    }
  });
  const move = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onMove?.(Math.max(0, Math.min(375, event.point.x * 40 + 187.5)));
  };
  return (
    <group>
      <Chassis showcase={false} />
      {engine && (
        <>
          <ReactorField engine={engine} reducedMotion={reducedMotion} />
          <ImpactEffects engine={engine} reducedMotion={reducedMotion} />
          <PowerAuras engine={engine} reducedMotion={reducedMotion} />
        </>
      )}
      <instancedMesh
        ref={cores}
        args={[undefined, undefined, brickCapacity]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={bricks}
        args={[bodyGeometry, undefined, brickCapacity]}
        count={0}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshPhysicalMaterial
          color="#9ba2c8"
          metalness={0.42}
          roughness={0.13}
          clearcoat={1}
          clearcoatRoughness={0.08}
          iridescence={0.45}
          emissive="#365987"
          emissiveIntensity={0.17}
          envMapIntensity={1.3}
        />
      </instancedMesh>
      <group ref={paddle}>
        <mesh geometry={bodyGeometry} scale={[1, 1, 0.27]} castShadow>
          <meshStandardMaterial
            ref={paddleMaterial}
            color={COLORS.peach}
            metalness={0.72}
            roughness={0.2}
            emissive={COLORS.peach}
            emissiveIntensity={0.45}
          />
        </mesh>
        <mesh position={[0, 0.11, 0.144]}>
          <boxGeometry args={[0.65, 0.11, 0.005]} />
          <meshBasicMaterial color="#fff8ed" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            geometry={bodyGeometry}
            position={[side * 0.405, 0, 0]}
            scale={[0.08, 1.07, 0.28]}
          >
            <meshStandardMaterial
              color="#57516c"
              metalness={0.84}
              roughness={0.21}
            />
          </mesh>
        ))}
      </group>
      <instancedMesh
        ref={balls}
        args={[undefined, undefined, ballCapacity]}
        count={0}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial
          roughness={0.08}
          metalness={0.05}
          emissive="#ffeddb"
          emissiveIntensity={1.35}
        />
      </instancedMesh>
      <instancedMesh
        ref={trails}
        args={[undefined, undefined, ballCapacity * 5]}
        count={0}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent opacity={0.21} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={particles}
        args={[undefined, undefined, MAX_PARTICLES]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.9} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={drops}
        args={[undefined, undefined, dropCapacity]}
        count={0}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          metalness={0.65}
          roughness={0.16}
          emissive="#dbe1ff"
          emissiveIntensity={0.22}
        />
      </instancedMesh>
      {Object.entries(POWER_GLYPHS).map(([type, glyph]) => (
        <DropLabelLayer
          key={type}
          engine={engine}
          type={type}
          glyph={glyph}
          capacity={dropCapacity}
        />
      ))}
      <mesh
        position={[0, -1, 0]}
        onPointerMove={move}
        onPointerDown={(event) => {
          move(event);
          (
            event.target as unknown as {
              setPointerCapture: (id: number) => void;
            }
          ).setPointerCapture(event.pointerId);
          onLaunch?.();
        }}
        onPointerUp={(event) => {
          (
            event.target as unknown as {
              releasePointerCapture: (id: number) => void;
            }
          ).releasePointerCapture(event.pointerId);
        }}
      >
        <planeGeometry args={[30, 35]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
    </group>
  );
}

/** A local Canvas 2D fallback preserves play when hardware acceleration is unavailable. */
function CompatibleArena({
  engine,
  variant,
  onMove,
  onLaunch,
  onReady,
}: ArenaProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mapping = useRef({ scale: 1, left: 0 });
  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (!surface || !context) return;
    let request = 0;
    const render = () => {
      const { width, height } = surface.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (
        surface.width !== Math.round(width * dpr) ||
        surface.height !== Math.round(height * dpr)
      ) {
        surface.width = Math.round(width * dpr);
        surface.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const scale = Math.min(width / 405, height / 627);
      const left = (width - 375 * scale) / 2;
      const top = (height - 587 * scale) / 2;
      mapping.current = { scale, left };
      context.translate(left, top - 80 * scale);
      context.scale(scale, scale);
      context.fillStyle = "#15182a";
      context.fillRect(0, 80, 375, 587);
      context.strokeStyle = "#55586f";
      context.lineWidth = 1.2;
      context.strokeRect(0, 80, 375, 587);
      context.strokeStyle = "#292c40";
      context.lineWidth = 0.5;
      context.beginPath();
      for (let x = 10; x < 375; x += 20) {
        context.moveTo(x, 80);
        context.lineTo(x, 667);
      }
      for (let y = 90; y < 667; y += 20) {
        context.moveTo(0, y);
        context.lineTo(375, y);
      }
      context.stroke();
      const block = (
        x: number,
        y: number,
        w: number,
        h: number,
        color: string,
      ) => {
        context.fillStyle = "#090b17";
        context.fillRect(x + 2, y + 3, w, h);
        context.fillStyle = color;
        context.beginPath();
        context.roundRect(x, y, w, h, Math.min(2.5, w / 7));
        context.fill();
        context.fillStyle = "#ffffff44";
        context.fillRect(x + 1, y + 1, w - 2, 1);
      };
      const scene = engine?.scene as SceneView | undefined;
      if (variant === "play" && scene) {
        const field = scene.brickField;
        if (field)
          for (const row of field.bricks)
            for (const brick of row) {
              if (!brick?.alive) continue;
              const rect = field.getBrickRect(brick.row, brick.col);
              block(rect.x, rect.y, rect.w, rect.h, brickColor(brick));
            }
        if (scene.paddle) {
          const p = scene.paddle;
          block(
            p.x - p.width / 2,
            p.y - p.height / 2,
            p.width,
            p.height,
            p.isWide ? COLORS.cyan : COLORS.peach,
          );
        }
        for (const ball of scene.balls) {
          context.fillStyle = ball.isFireball ? "#ff9f5a" : COLORS.white;
          context.shadowColor = context.fillStyle;
          context.shadowBlur = 10;
          context.beginPath();
          context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
        }
        for (const drop of scene.powerUpDrops) {
          if (!drop.alive) continue;
          context.save();
          context.translate(drop.x, drop.y);
          context.rotate(Math.PI / 4);
          context.fillStyle = COLORS.cyan;
          context.fillRect(-7, -7, 14, 14);
          context.restore();
          context.fillStyle = "#171728";
          context.font = "bold 11px Arial";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(POWER_GLYPHS[drop.type] || "+", drop.x, drop.y);
        }
      } else {
        const shades = [COLORS.peach, "#d6b3d4", COLORS.lavender, COLORS.cyan];
        for (let row = 0; row < 5; row++)
          for (let col = 0; col < 8; col++) {
            if ((row === 0 || row === 4) && (col < 1 || col > 6)) continue;
            block(
              17 + col * 43,
              111 + row * 42,
              37,
              36,
              shades[Math.min(row, 3)],
            );
          }
        block(116, 567, 108, 10, COLORS.peach);
        context.fillStyle = COLORS.white;
        context.beginPath();
        context.arc(229, 460, 5, 0, Math.PI * 2);
        context.fill();
      }
      request = requestAnimationFrame(render);
    };
    request = requestAnimationFrame(render);
    onReady?.();
    return () => cancelAnimationFrame(request);
  }, [engine, variant, onReady]);
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onMove?.(
      Math.max(
        0,
        Math.min(
          375,
          (event.clientX - rect.left - mapping.current.left) /
            mapping.current.scale,
        ),
      ),
    );
  };
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvas}
        aria-label={variant === "play" ? "打砖块兼容画面" : "星界打砖块"}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: variant === "play" ? "none" : "auto",
        }}
        onPointerMove={move}
        onPointerDown={(event) => {
          move(event);
          event.currentTarget.setPointerCapture(event.pointerId);
          onLaunch?.();
        }}
        onPointerUp={(event) =>
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      />
      <span
        style={{
          position: "absolute",
          bottom: 8,
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none",
          color: "#9094ad",
          fontSize: 10,
          letterSpacing: 1,
        }}
      >
        兼容画面 · 玩法完整保留
      </span>
    </div>
  );
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

let webglSupport: boolean | undefined;
function hasWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const testCanvas = document.createElement("canvas");
    const context = testCanvas.getContext("webgl2");
    webglSupport = !!context;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

export default function Arena(props: ArenaProps) {
  const { engine, variant, quality, reducedMotion, onMove, onLaunch, onReady } =
    props;
  const fallback = <CompatibleArena {...props} />;
  if (!hasWebGL()) return fallback;
  return (
    <WebGLErrorBoundary fallback={fallback}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 30], zoom: 40, near: 0.1, far: 150 }}
        dpr={quality === "high" ? [1, 1.75] : 1}
        shadows={quality === "high"}
        fallback={fallback}
        gl={{
          alpha: true,
          antialias: quality === "high",
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#090b16", 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          onReady?.();
        }}
        style={{
          width: "100%",
          height: "100%",
          touchAction: variant === "play" ? "none" : "auto",
          display: "block",
        }}
      >
        <CameraRig
          variant={variant}
          engine={engine}
          reducedMotion={reducedMotion}
        />
        <StudioLighting quality={quality} />
        <ArcadeBloom
          enabled={variant === "play" && quality === "high" && !reducedMotion}
        />
        {variant === "showcase" ? (
          <Showcase reducedMotion={reducedMotion} />
        ) : (
          <Playfield
            engine={engine}
            reducedMotion={reducedMotion}
            onMove={onMove}
            onLaunch={onLaunch}
          />
        )}
      </Canvas>
    </WebGLErrorBoundary>
  );
}
