import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { GameEngine } from "../game/engine";
import type { GameFeedback } from "../game/types";

const px = (x: number) => (x - 187.5) / 40;
const py = (y: number) => (333.5 - y) / 40;
const duration = (e: GameFeedback) =>
  e.kind === "pulse"
    ? 1.6
    : e.kind === "powerCollect"
      ? 1.2
      : e.kind === "win"
        ? 3
        : 0.75;
const random = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function ArcadeBloom({ enabled }: { enabled: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const pipeline = useMemo(() => {
    if (!enabled) return null;
    const composer = new EffectComposer(gl);
    const render = new RenderPass(
      scene,
      camera,
      undefined,
      new THREE.Color("#000000"),
      1,
    );
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.46,
      0.36,
      0.95,
    );
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(bloom);
    composer.addPass(output);
    return { composer, bloom, render, output };
  }, [gl, scene, camera, enabled]);
  useEffect(() => {
    if (!pipeline) return;
    pipeline.composer.setSize(size.width, size.height);
    pipeline.composer.setPixelRatio(Math.min(gl.getPixelRatio(), 1.5));
  }, [pipeline, size, gl]);
  useEffect(
    () => () => {
      pipeline?.composer.dispose();
      pipeline?.bloom.dispose();
      pipeline?.render.dispose();
      pipeline?.output.dispose();
    },
    [pipeline],
  );
  useFrame(() => {
    if (pipeline) pipeline.composer.render();
    else gl.render(scene, camera);
  }, 1);
  return null;
}

const vertex = `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
const fragment = `
varying vec2 vUv;
uniform float time;
uniform float energy;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){
 vec2 p=vUv-.5;
 float cloud=noise(p*4.+vec2(time*.013,-time*.008))*.5+noise(p*8.-time*.015)*.25+noise(p*16.)*.125;
 float ribbon=pow(max(0.,1.-abs(p.x+sin(p.y*5.+time*.045)*.2)*2.),4.);
 vec3 col=mix(vec3(.012,.018,.045),vec3(.026,.025,.092),cloud);
 col+=vec3(.065,.012,.12)*ribbon*cloud*.9;
 col+=vec3(.01,.07,.09)*pow(max(0.,1.-length(p-vec2(.3,-.4))),4.);
 col+=vec3(.14,.03,.005)*energy*pow(max(0.,1.-length(p)*1.6),3.);
 gl_FragColor=vec4(col,1.);
}
`;

export function ReactorField({
  engine,
  reducedMotion,
}: {
  engine: GameEngine;
  reducedMotion: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const stars = useMemo(() => {
    const positions = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      positions[i * 3] = (random(i + 1) - 0.5) * 9.2;
      positions[i * 3 + 1] = (random(i + 400) - 0.5) * 14.4 - 1;
      positions[i * 3 + 2] = -0.13;
    }
    return new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
  }, []);
  useEffect(() => () => stars.dispose(), [stars]);
  useFrame(() => {
    if (material.current) {
      material.current.uniforms.time.value = reducedMotion ? 0 : engine.elapsed;
      material.current.uniforms.energy.value =
        engine.getSnapshot().pulseTime > 0
          ? 0.8
          : engine.getSnapshot().energy / 400;
    }
    if (ring.current && !reducedMotion)
      ring.current.rotation.z = engine.elapsed * 0.025;
  });
  return (
    <group>
      <mesh position={[0, -1, -0.15]}>
        <planeGeometry args={[9.32, 14.55]} />
        <shaderMaterial
          ref={material}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={{ time: { value: 0 }, energy: { value: 0 } }}
        />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial
          color="#83c4ff"
          size={0.025}
          transparent
          opacity={0.65}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <mesh ref={ring} position={[0, -1, -0.75]} rotation={[0, 0, -0.35]}>
        <ringGeometry args={[5.65, 5.67, 128, 1, 0, Math.PI * 1.7]} />
        <meshBasicMaterial
          color="#5c6fd9"
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** A fixed visual pool: effects never create physics entities or consume events. */
export function ImpactEffects({
  engine,
  reducedMotion,
}: {
  engine: GameEngine;
  reducedMotion: boolean;
}) {
  const rings = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(
    () => ({ obj: new THREE.Object3D(), color: new THREE.Color() }),
    [],
  );
  useFrame(() => {
    const { obj, color } = scratch;
    let ringCount = 0,
      sparkCount = 0,
      beamCount = 0,
      haloCount = 0;
    const latest = engine.feedback.filter(
      (event) => engine.elapsed - event.time < duration(event),
    );
    for (const e of latest) {
      // Pickup confirmation belongs to the page header, never the playfield.
      if (e.kind === "powerCollect") continue;
      const age = Math.max(0, engine.elapsed - e.time);
      const life = duration(e);
      const progress = age / life;
      if (e.kind === "wall" || (e.kind === "brick" && !e.points)) continue;
      const special = ["pulse", "win"].includes(e.kind);
      const scale =
        e.kind === "pulse"
          ? 0.6 + progress * 11
          : e.kind === "win"
            ? progress * 10
            : 0.12 + progress * 0.95;
      color.set(e.color).multiplyScalar((1 - progress) * (special ? 3 : 2.2));
      if (rings.current && ringCount < 80) {
        obj.position.set(px(e.x), py(e.y), 0.35);
        obj.rotation.set(0, 0, age);
        obj.scale.setScalar(reducedMotion ? 0.3 : scale);
        obj.updateMatrix();
        rings.current.setMatrixAt(ringCount, obj.matrix);
        rings.current.setColorAt(ringCount++, color);
      }
      if (reducedMotion) continue;
      const count = special ? 48 : e.kind === "brick" ? 12 : 6;
      for (let i = 0; i < count && sparkCount < 1400; i++) {
        const seed = e.id * 97 + i * 13;
        const angle = random(seed) * Math.PI * 2;
        const velocity = (special ? 4.5 : 1.6) * (0.4 + random(seed + 4));
        const radius = age * velocity;
        obj.position.set(
          px(e.x) + Math.cos(angle) * radius,
          py(e.y) + Math.sin(angle) * radius - age * age * 0.65,
          0.18 + Math.sin(progress * Math.PI) * random(seed + 7) * 1.8,
        );
        obj.rotation.set(age * 7, age * 9, angle);
        const sz = (0.018 + random(seed + 8) * 0.035) * (1 - progress);
        obj.scale.set(sz, sz * (special ? 3 : 1.6), sz);
        obj.updateMatrix();
        sparks.current?.setMatrixAt(sparkCount, obj.matrix);
        sparks.current?.setColorAt(sparkCount++, color);
      }
      if (beams.current && e.kind === "pulse" && beamCount < 12) {
        for (let i = 0; i < 6 && beamCount < 12; i++) {
          obj.position.set(px(e.x), py(e.y), 0.2);
          obj.rotation.set(0, 0, (i * Math.PI) / 3 + progress * 0.12);
          obj.scale.set(0.017 * (1 - progress), 3 + progress * 14, 1);
          obj.updateMatrix();
          beams.current.setMatrixAt(beamCount, obj.matrix);
          beams.current.setColorAt(beamCount++, color);
        }
      }
    }
    const fireballs = engine.scene.balls.filter((b) => b.isFireball);
    for (const ball of fireballs.slice(0, 24)) {
      if (!halo.current) break;
      obj.position.set(px(ball.x), py(ball.y), 0.24);
      obj.rotation.set(0, 0, 0);
      obj.scale.setScalar(
        0.18 + (reducedMotion ? 0 : Math.sin(engine.elapsed * 17) * 0.025),
      );
      obj.updateMatrix();
      halo.current.setMatrixAt(haloCount, obj.matrix);
      halo.current.setColorAt(
        haloCount++,
        color.set("#ff652d").multiplyScalar(2.6),
      );
    }
    for (const [ref, count] of [
      [rings, ringCount],
      [sparks, sparkCount],
      [beams, beamCount],
      [halo, haloCount],
    ] as const) {
      if (!ref.current) continue;
      ref.current.count = count;
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor)
        ref.current.instanceColor.needsUpdate = true;
    }
  });
  return (
    <group>
      <instancedMesh
        ref={rings}
        args={[undefined, undefined, 80]}
        count={0}
        frustumCulled={false}
      >
        <ringGeometry args={[0.93, 1, 48]} />
        <meshBasicMaterial
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={sparks}
        args={[undefined, undefined, 1400]}
        count={0}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={beams}
        args={[undefined, undefined, 12]}
        count={0}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={halo}
        args={[undefined, undefined, 24]}
        count={0}
        frustumCulled={false}
      >
        <ringGeometry args={[0.65, 1, 24]} />
        <meshBasicMaterial
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

export function PowerAuras({
  engine,
  reducedMotion,
}: {
  engine: GameEngine;
  reducedMotion: boolean;
}) {
  const rings = useRef<THREE.InstancedMesh>(null);
  const obj = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    if (!rings.current) return;
    let count = 0;
    const palette: Record<string, string> = {
      split: "#71f9ff",
      multiShot: "#b791ff",
      fireball: "#ff8955",
      widePaddle: "#8fffc5",
      extraLife: "#ff86b5",
    };
    for (const drop of engine.scene.powerUpDrops
      .filter((d) => d.alive)
      .slice(0, 100)) {
      for (let layer = 0; layer < 2; layer++) {
        obj.position.set(px(drop.x), py(drop.y), 0.15);
        obj.rotation.set(
          layer === 1 ? 0.9 : 0,
          layer === 1 ? 0.6 : 0,
          reducedMotion ? 0 : engine.elapsed * (layer === 1 ? -2 : 1),
        );
        obj.scale.setScalar(0.3 + layer * 0.085);
        obj.updateMatrix();
        rings.current.setMatrixAt(count, obj.matrix);
        rings.current.setColorAt(
          count++,
          color.set(palette[drop.type]).multiplyScalar(2),
        );
      }
    }
    rings.current.count = count;
    rings.current.instanceMatrix.needsUpdate = true;
    if (rings.current.instanceColor)
      rings.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={rings}
      args={[undefined, undefined, 200]}
      count={0}
      frustumCulled={false}
    >
      <torusGeometry args={[1, 0.035, 6, 36]} />
      <meshBasicMaterial
        transparent
        opacity={0.8}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
