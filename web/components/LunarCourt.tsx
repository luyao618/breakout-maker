import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { GameEngine } from "../game/engine";

const noiseGLSL = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return v;}
`;

/** A screen-space nebula fills the world without moving the player's camera. */
function NightSky({
  engine,
  reducedMotion,
}: {
  engine: GameEngine | null;
  reducedMotion: boolean;
}) {
  const { size } = useThree();
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ time: { value: 0 }, aspect: { value: 1 } }),
    [],
  );
  useFrame(() => {
    uniforms.time.value = reducedMotion ? 0 : (engine?.elapsed ?? 0);
    uniforms.aspect.value = size.width / Math.max(1, size.height);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
        vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`}
        fragmentShader={`
          varying vec2 vUv;uniform float time;uniform float aspect;
          ${noiseGLSL}
          void main(){
            vec2 p=(vUv-.5)*vec2(aspect,1.);
            vec2 drift=vec2(time*.0008,-time*.0004);
            float cloud=fbm(p*3.1+drift);
            vec2 q=p-vec2(-.48,.21);
            float angle=atan(q.y,q.x),r=length(q);
            float ribbon=pow(.5+.5*sin(r*17.-angle*2.+cloud*5.),5.);
            float veil=fbm(p*6.3+vec2(cloud*2.));
            float periphery=smoothstep(.13,.72,abs(p.x));
            vec3 col=vec3(.002,.004,.012);
            col+=vec3(.008,.015,.047)*cloud*cloud*2.;
            col+=vec3(.010,.026,.070)*ribbon*veil*(.4+periphery);
            col+=vec3(.033,.012,.047)*pow(veil,3.)*periphery;
            vec2 grid=vUv*vec2(185.*aspect,185.);
            vec2 id=floor(grid),uv=fract(grid)-.5;
            float seed=hash(id);
            float star=pow(max(0.,1.-length(uv)*7.),3.);
            if(seed>.986){
              vec3 tint=mix(vec3(.45,.63,1.),vec3(1.,.84,.56),hash(id+12.));
              col+=tint*star*(.13+hash(id+5.)*.8);
              if(seed>.9993){
                float crossGlow=exp(-abs(uv.x)*90.)*exp(-abs(uv.y)*7.)+exp(-abs(uv.y)*90.)*exp(-abs(uv.x)*7.);
                col+=tint*crossGlow*.23;
              }
            }
            col*=1.-.4*smoothstep(.38,.78,length(vUv-.5));
            gl_FragColor=vec4(col,1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`}
      />
    </mesh>
  );
}

function moonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#8992a5";
  ctx.fillRect(0, 0, 512, 256);
  let seed = 19;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < 320; i++) {
    const x = random() * 512,
      y = random() * 256,
      radius = 1 + Math.pow(random(), 3) * 16;
    const grad = ctx.createRadialGradient(
      x + radius * 0.2,
      y - radius * 0.16,
      radius * 0.15,
      x,
      y,
      radius,
    );
    grad.addColorStop(0, "#39435c44");
    grad.addColorStop(0.64, "#53617b22");
    grad.addColorStop(0.86, "#ced4da22");
    grad.addColorStop(1, "#7e8ba700");
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function Moon() {
  const { size } = useThree();
  const map = useMemo(moonTexture, []);
  useEffect(() => () => map.dispose(), [map]);
  if (size.width / Math.max(1, size.height) < 1.12) return null;
  return (
    <group position={[-10.6, 6.2, -5.5]}>
      <mesh rotation={[0.2, -0.5, -0.3]}>
        <sphereGeometry args={[2.85, 64, 40]} />
        <shaderMaterial
          uniforms={{ surface: { value: map } }}
          vertexShader={`varying vec2 vUv;varying vec3 n;void main(){vUv=uv;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`uniform sampler2D surface;varying vec2 vUv;varying vec3 n;
          void main(){float light=max(0.,dot(normalize(n),normalize(vec3(-.95,.28,.18))));
          vec3 albedo=texture2D(surface,vUv).rgb;
          vec3 color=vec3(.003,.006,.016)+albedo*vec3(.46,.61,.9)*light*.65;
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.9, 40, 24]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`}
          fragmentShader={`varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.);gl_FragColor=vec4(.18,.38,.9,rim*.14);}`}
        />
      </mesh>
    </group>
  );
}

export function LunarLighting({ quality }: { quality: "high" | "low" }) {
  return (
    <>
      <ambientLight color="#9aa9e6" intensity={0.28} />
      <directionalLight
        position={[-6, 4, 13]}
        color="#e6eaff"
        intensity={2.5}
        castShadow={quality === "high"}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-normalBias={0.018}
        shadow-bias={-0.0001}
        shadow-radius={3}
      />
      <directionalLight
        position={[5, -8, 7]}
        color="#84ceff"
        intensity={1.05}
      />
      <Suspense fallback={null}>
        <Environment resolution={quality === "high" ? 256 : 128} frames={1}>
          <color attach="background" args={["#171d35"]} />
          <Lightformer
            form="rect"
            position={[-6, 3, 9]}
            rotation={[0, -0.6, -0.15]}
            scale={[4, 12, 1]}
            color="#cedfff"
            intensity={3.5}
          />
          <Lightformer
            form="rect"
            position={[6, -1, 8]}
            rotation={[0, 0.6, 0.2]}
            scale={[3, 11, 1]}
            color="#9aaeff"
            intensity={2.4}
          />
          <Lightformer
            form="rect"
            position={[0, -8, 5]}
            rotation={[0.5, 0, 0]}
            scale={[8, 2, 1]}
            color="#fff0d1"
            intensity={2.5}
          />
        </Environment>
      </Suspense>
    </>
  );
}

function Part({
  size,
  position,
  color,
  emission = 0,
  metalness = 0.6,
  roughness = 0.24,
  radius = 0.04,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  emission?: number;
  metalness?: number;
  roughness?: number;
  radius?: number;
}) {
  const geometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        ...size,
        3,
        Math.min(radius, ...size.map((n) => n / 2)),
      ),
    [size[0], size[1], size[2], radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={color}
        emissiveIntensity={emission}
      />
    </mesh>
  );
}

function GlassField({
  engine,
  reducedMotion,
}: {
  engine: GameEngine | null;
  reducedMotion: boolean;
}) {
  const { energy, time } = useMemo(
    () => ({ energy: { value: 0 }, time: { value: 0 } }),
    [],
  );
  const uniforms = useMemo(() => ({ energy, time }), [energy, time]);
  useFrame(() => {
    time.value = reducedMotion ? 0 : (engine?.elapsed ?? 0);
    energy.value = (engine?.getSnapshot().energy ?? 0) / 100;
  });
  return (
    <>
      <mesh position={[0, -1, -0.116]} receiveShadow>
        <planeGeometry args={[9.42, 14.76]} />
        <meshPhysicalMaterial
          color="#02040b"
          metalness={0.45}
          roughness={0.58}
          clearcoat={0.12}
          clearcoatRoughness={0.5}
          envMapIntensity={0.08}
        />
      </mesh>
      <mesh position={[0, -1, -0.108]}>
        <planeGeometry args={[9.42, 14.76]} />
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`varying vec2 vUv;uniform float energy;uniform float time;${noiseGLSL}
          void main(){vec2 p=vUv-.5;float n=fbm(p*5.+vec2(time*.001,0.));
            float w=pow(max(0.,1.-abs(p.x+sin(p.y*4.)*.18)*2.6),3.);
            vec3 col=vec3(.035,.06,.17)*n*w+vec3(.035,.03,.1)*fbm(p*9.);
            col+=vec3(.12,.045,.018)*energy*pow(max(0.,1.-length(p)*1.5),4.);
            vec2 grid=vUv*vec2(45.,70.);vec2 g=fract(grid)-.5;
            if(hash(floor(grid))>.972)col+=vec3(.1,.18,.28)*pow(max(0.,1.-length(g)*7.),3.);
            gl_FragColor=vec4(col,.7);}`}
        />
      </mesh>
    </>
  );
}

export default function LunarCourt({
  engine,
  reducedMotion,
}: {
  engine: GameEngine | null;
  reducedMotion: boolean;
}) {
  return (
    <group>
      <NightSky engine={engine} reducedMotion={reducedMotion} />
      <Moon />
      <Part
        size={[10.05, 15.22, 0.38]}
        position={[0, -1, -0.57]}
        color="#151e34"
        metalness={0.8}
        roughness={0.28}
        radius={0.14}
      />
      <Part
        size={[9.9, 15.08, 0.055]}
        position={[0, -1, -0.34]}
        color="#6989c0"
        emission={0.18}
        metalness={0.82}
        radius={0.02}
      />
      <Part
        size={[9.76, 14.94, 0.16]}
        position={[0, -1, -0.24]}
        color="#101a2d"
        metalness={0.78}
        radius={0.07}
      />
      <GlassField engine={engine} reducedMotion={reducedMotion} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Part
            size={[0.19, 14.83, 0.2]}
            position={[side * 4.805, -1, -0.005]}
            color="#74849f"
            metalness={0.9}
            roughness={0.18}
            radius={0.055}
          />
          <Part
            size={[0.032, 14.52, 0.03]}
            position={[side * 4.697, -1, -0.019]}
            color={side === -1 ? "#7ba7ff" : "#b397ff"}
            emission={2.4}
            metalness={0.1}
            radius={0.011}
          />
          {[-6.8, -2.9, 1, 4.9].map((y, i) => (
            <group key={y}>
              <Part
                size={[0.33, 0.83, 0.25]}
                position={[side * 4.9, y, -0.045]}
                color="#24334e"
                metalness={0.86}
                radius={0.06}
              />
              <Part
                size={[0.11, 0.39, 0.027]}
                position={[side * 4.93, y, 0.091]}
                color={i % 2 ? "#f2c78f" : "#9bb8ef"}
                metalness={0.7}
                emission={0.05}
                radius={0.013}
              />
              <Part
                size={[0.045, 0.16, 0.02]}
                position={[side * 4.775, y, 0.091]}
                color="#a7deff"
                emission={2}
                metalness={0.1}
                radius={0.007}
              />
            </group>
          ))}
        </group>
      ))}
      <Part
        size={[9.57, 0.13, 0.18]}
        position={[0, 6.43, -0.012]}
        color="#8091b0"
        metalness={0.87}
        radius={0.04}
      />
      <Part
        size={[9.25, 0.025, 0.025]}
        position={[0, 6.34, -0.01]}
        color="#9aafff"
        emission={1.6}
        metalness={0.1}
        radius={0.009}
      />
      <Part
        size={[9.52, 0.15, 0.16]}
        position={[0, -8.42, -0.2]}
        color="#4e617f"
        metalness={0.84}
        radius={0.05}
      />
      <Part
        size={[3.9, 0.022, 0.017]}
        position={[0, -8.514, -0.42]}
        color="#a3cfff"
        emission={1.3}
        metalness={0.1}
        radius={0.005}
      />
      {[-1, 1].map((side) => (
        <Part
          key={side}
          size={[1.18, 0.025, 0.017]}
          position={[side * 3.5, -8.514, -0.42]}
          color="#f2c78f"
          emission={0.8}
          metalness={0.2}
          radius={0.005}
        />
      ))}
    </group>
  );
}
