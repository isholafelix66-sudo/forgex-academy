/**
 * FORGEX LEARNING DEVICE — the interactive 3D centerpiece of the homepage.
 *
 * A premium matte-black + electric-lime futuristic learning machine. It starts
 * CLOSED, slowly floating and rotating in space. When the visitor scrolls (or
 * hovers / taps it), the machine mechanically opens: the top lid lifts and
 * unfolds on a rear hinge, polished side rails slide apart, a telescoping
 * piston rises and a soft neon-lime light glows from the interior bay.
 *
 * Then the transformation happens: real 3D objects physically EMERGE from
 * inside the device — laptop, phone, camera, headphones, tablet, keyboard,
 * a 3D book, an AI holographic panel and floating course cards. Each starts
 * small inside the bay, then rises, unfolds and floats outward along its own
 * trajectory. Once out, the objects stay suspended around the device, gently
 * orbiting and floating with natural depth. The device remains the central
 * "source".
 *
 * The three act narrative maps onto the hero headline:
 *   DISCOVER → the device is closed, floating and rotating
 *   EXPRESS  → the machine opens, the interior glows
 *   BUILD    → objects emerge and the ForgeX ecosystem forms around it
 *
 * Built from Three.js primitives + RoundedBoxGeometry (no external models,
 * no drei). Performance-minded:
 *  - no shadow maps, no post-processing, tiny particle counts
 *  - device pixel ratio capped (lower on touch devices)
 *  - rendering pauses when the canvas leaves the viewport
 *  - mobile shows a reduced object set (6 instead of 9), fewer particles,
 *    a single light ring and no pointer parallax
 *  - prefers-reduced-motion disables ambient animation (float/orbit/trails)
 *  - iOS/iPadOS (WebKit — includes Chrome on iOS) never creates a WebGL
 *    context: it uses the animated SVG fallback instead, so a GPU-process
 *    crash can never reload the page. The fallback keeps the same
 *    scroll/tap/hover opening and object emergence.
 */
import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/* Palette & shared math                                               */
/* ------------------------------------------------------------------ */

const LIME = "#a3e635";
const LIME_SOFT = "#d9f99d";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const smoothstep = (v: number, a: number, b: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Quadratic bezier point. */
function bezier3(
  a: [number, number, number],
  m: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * m[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * m[1] + t * t * b[1],
    u * u * a[2] + 2 * u * t * m[2] + t * t * b[2],
  ];
}

/* ------------------------------------------------------------------ */
/* Environment / capability detection                                  */
/* ------------------------------------------------------------------ */

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * iOS/iPadOS (WebKit — includes Safari AND Chrome on iOS, which is also
 * WebKit under the hood). WebGL on iOS Safari is a well-known source of GPU
 * process crashes: when the GPU process dies, Safari reloads the whole tab,
 * which reads as "the app keeps refreshing". We skip the WebGL canvas on iOS
 * entirely and show the animated SVG machine instead.
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports itself as macOS, so also check for a touch-capable
  // Mac user agent.
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isCoarsePointer(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/* ------------------------------------------------------------------ */
/* Small 3D helpers                                                    */
/* ------------------------------------------------------------------ */

function RoundedBox({
  w,
  h,
  d,
  r,
  material,
  position,
  rotation,
}: {
  w: number;
  h: number;
  d: number;
  r: number;
  material: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const geometry = useMemo(
    () => new RoundedBoxGeometry(w, h, d, 4, r),
    [w, h, d, r],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} material={material} position={position} rotation={rotation} />
  );
}

/** Radial-gradient canvas texture (soft glow / contact shadow). */
function radialTexture(stops: Array<[number, string]>): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  const g = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Floating object config — the ForgeX ecosystem                       */
/* ------------------------------------------------------------------ */

type FloatKind =
  | "laptop"
  | "phone"
  | "camera"
  | "headphones"
  | "tablet"
  | "keyboard"
  | "book"
  | "aiPanel"
  | "cards";

type FloatCfg = {
  id: string;
  label: string;
  kind: FloatKind;
  /** Inside the device (origin point of emergence). */
  from: [number, number, number];
  /** Arc control point. */
  mid: [number, number, number];
  /** Final floating anchor. */
  to: [number, number, number];
  /** Open-progress window where this object emerges. */
  start: number;
  end: number;
  orbitR: number;
  orbitSpeed: number;
  orbitPhase: number;
  bobAmp: number;
  bobSpeed: number;
  spin: number;
  scale: number;
  par: number;
  rotX: number;
  rotY: number;
  rotZ: number;
};

const FLOAT_CFG: FloatCfg[] = [
  {
    id: "laptop",
    label: "LEARN",
    kind: "laptop",
    from: [0, 0.9, -0.05],
    mid: [0, 2.0, -0.4],
    to: [-0.95, 1.6, -1.7],
    start: 0.3,
    end: 0.55,
    orbitR: 0.28,
    orbitSpeed: 0.14,
    orbitPhase: 0.3,
    bobAmp: 0.08,
    bobSpeed: 1.0,
    spin: 0.12,
    scale: 1,
    par: 0.5,
    rotX: -0.05,
    rotY: 0.55,
    rotZ: 0.05,
  },
  {
    id: "phone",
    label: "CONNECT",
    kind: "phone",
    from: [-0.2, 0.9, 0.05],
    mid: [-0.6, 2.2, -0.2],
    to: [-2.0, 1.95, -0.55],
    start: 0.34,
    end: 0.6,
    orbitR: 0.22,
    orbitSpeed: -0.18,
    orbitPhase: 1.2,
    bobAmp: 0.09,
    bobSpeed: 1.15,
    spin: 0.2,
    scale: 0.85,
    par: 0.6,
    rotX: 0.1,
    rotY: -0.5,
    rotZ: 0.15,
  },
  {
    id: "camera",
    label: "CREATE",
    kind: "camera",
    from: [0.2, 0.9, 0.02],
    mid: [0.7, 1.9, 0.0],
    to: [2.0, 1.35, 0.35],
    start: 0.38,
    end: 0.62,
    orbitR: 0.3,
    orbitSpeed: 0.16,
    orbitPhase: 2.0,
    bobAmp: 0.07,
    bobSpeed: 0.9,
    spin: 0.1,
    scale: 1,
    par: 0.5,
    rotX: 0,
    rotY: -0.45,
    rotZ: 0,
  },
  {
    id: "tablet",
    label: "DESIGN",
    kind: "tablet",
    from: [0.05, 0.92, 0],
    mid: [0.1, 2.4, 0.1],
    to: [0.5, 2.65, -1.15],
    start: 0.42,
    end: 0.68,
    orbitR: 0.26,
    orbitSpeed: -0.12,
    orbitPhase: 3.0,
    bobAmp: 0.1,
    bobSpeed: 0.85,
    spin: 0.14,
    scale: 1,
    par: 0.7,
    rotX: -0.08,
    rotY: -0.7,
    rotZ: -0.05,
  },
  {
    id: "aiPanel",
    label: "AI",
    kind: "aiPanel",
    from: [0, 0.95, -0.1],
    mid: [0, 2.7, 0.3],
    to: [0, 3.05, 0.85],
    start: 0.48,
    end: 0.75,
    orbitR: 0.18,
    orbitSpeed: 0.1,
    orbitPhase: 0.8,
    bobAmp: 0.12,
    bobSpeed: 0.7,
    spin: 0.08,
    scale: 1.05,
    par: 0.9,
    rotX: -0.15,
    rotY: 0.9,
    rotZ: -0.18,
  },
  {
    id: "book",
    label: "KNOWLEDGE",
    kind: "book",
    from: [-0.15, 0.9, 0.08],
    mid: [-0.5, 1.8, 0.15],
    to: [-1.55, 2.5, 1.15],
    start: 0.52,
    end: 0.78,
    orbitR: 0.5,
    orbitSpeed: 0.09,
    orbitPhase: 2.4,
    bobAmp: 0.09,
    bobSpeed: 0.95,
    spin: 0.06,
    scale: 0.95,
    par: 0.6,
    rotX: 0.05,
    rotY: 0.35,
    rotZ: 0.1,
  },
  {
    id: "headphones",
    label: "IMMERSE",
    kind: "headphones",
    from: [0.15, 0.9, 0.04],
    mid: [0.6, 1.7, 0.35],
    to: [1.5, 2.15, 1.3],
    start: 0.45,
    end: 0.72,
    orbitR: 0.34,
    orbitSpeed: -0.14,
    orbitPhase: 4.1,
    bobAmp: 0.08,
    bobSpeed: 1.05,
    spin: 0.1,
    scale: 0.95,
    par: 0.55,
    rotX: 0.1,
    rotY: -0.6,
    rotZ: 0,
  },
  {
    id: "keyboard",
    label: "BUILD",
    kind: "keyboard",
    from: [0.05, 0.88, 0.12],
    mid: [0.3, 1.5, 0.7],
    to: [0.7, 0.8, 1.95],
    start: 0.56,
    end: 0.82,
    orbitR: 0.2,
    orbitSpeed: 0.2,
    orbitPhase: 0.5,
    bobAmp: 0.06,
    bobSpeed: 1.2,
    spin: 0.15,
    scale: 0.95,
    par: 0.7,
    rotX: 0.35,
    rotY: 0.5,
    rotZ: 0,
  },
  {
    id: "cards",
    label: "MODULES",
    kind: "cards",
    from: [0.02, 0.95, -0.08],
    mid: [0.1, 1.7, -0.3],
    to: [-2.2, 1.2, -1.25],
    start: 0.6,
    end: 0.88,
    orbitR: 0.6,
    orbitSpeed: 0.12,
    orbitPhase: 5.2,
    bobAmp: 0.1,
    bobSpeed: 0.8,
    spin: 0.08,
    scale: 1,
    par: 0.8,
    rotX: 0.05,
    rotY: 0.8,
    rotZ: 0,
  },
];

/** Mobile renders the first N (essential) objects only. */
const MOBILE_OBJECT_COUNT = 6;

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

type Mats = {
  body: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  metal: THREE.MeshPhysicalMaterial;
  gloss: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  screen: THREE.MeshStandardMaterial;
  screenDark: THREE.MeshStandardMaterial;
  panelMat: THREE.MeshBasicMaterial;
  beam: THREE.MeshBasicMaterial;
  sweep: THREE.MeshBasicMaterial;
  ringA: THREE.MeshBasicMaterial;
  ringB: THREE.MeshBasicMaterial;
};

function createMaterials(): Mats {
  return {
    // matte-black body with a hint of sheen
    body: new THREE.MeshPhysicalMaterial({
      color: "#101318",
      metalness: 0.7,
      roughness: 0.3,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
    }),
    // dark recesses / deck
    dark: new THREE.MeshStandardMaterial({
      color: "#07090c",
      metalness: 0.45,
      roughness: 0.55,
    }),
    // polished rails / hinges
    metal: new THREE.MeshPhysicalMaterial({
      color: "#262b33",
      metalness: 0.95,
      roughness: 0.18,
      clearcoat: 0.5,
    }),
    // glossy lid strip
    gloss: new THREE.MeshPhysicalMaterial({
      color: "#3c434d",
      metalness: 0.9,
      roughness: 0.12,
      clearcoat: 0.85,
    }),
    // lime trims + accents
    trim: new THREE.MeshStandardMaterial({
      color: LIME,
      emissive: new THREE.Color(LIME),
      emissiveIntensity: 1.05,
      metalness: 0.25,
      roughness: 0.35,
    }),
    // bright core node
    core: new THREE.MeshStandardMaterial({
      color: "#2b3320",
      emissive: new THREE.Color(LIME_SOFT),
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.98,
    }),
    // display screen (glow animated per frame)
    screen: new THREE.MeshStandardMaterial({
      color: "#0a0d08",
      emissive: new THREE.Color(LIME),
      emissiveIntensity: 0.3,
      metalness: 0.2,
      roughness: 0.5,
    }),
    // dark glass for device screens
    screenDark: new THREE.MeshStandardMaterial({
      color: "#04060a",
      metalness: 0.55,
      roughness: 0.3,
    }),
    // holographic AI panel
    panelMat: new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    // additive light beam
    beam: new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    // display sweep line
    sweep: new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    ringA: new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    ringB: new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Camera rig + environment                                            */
/* ------------------------------------------------------------------ */

function Rig({ mobile, reduced }: { mobile: boolean; reduced: boolean }) {
  const { camera, pointer } = useThree();
  useFrame((_state, dt) => {
    const k = 1 - Math.exp(-dt * 2.4);
    const px = mobile || reduced ? 0 : pointer.x;
    const py = mobile || reduced ? 0 : pointer.y;
    camera.position.x += (px * 0.6 - camera.position.x) * k;
    camera.position.y += (1.78 + py * 0.3 - camera.position.y) * k;
    camera.lookAt(0, 1.02, 0);
  });
  return null;
}

/** Procedural room environment → premium metallic reflections, no HDR load. */
function Env() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = new RoomEnvironment();
    const rt = pmrem.fromScene(env, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.7;
    return () => {
      scene.environment = null;
      rt.dispose();
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Object geometry — every object is built from primitives             */
/* ------------------------------------------------------------------ */

function EarCup({
  side,
  mats,
  eRef,
}: {
  side: 1 | -1;
  mats: Mats;
  eRef: RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const e = eRef.current ?? 0;
    if (ref.current) ref.current.rotation.x = (1 - e) * 0.5;
  });
  return (
    <group ref={ref} position={[side * 0.2, -0.03, 0]}>
      <mesh material={mats.body} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 18]} />
      </mesh>
      <mesh material={mats.trim} position={[side * 0.027, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.012, 18]} />
      </mesh>
    </group>
  );
}

function ObjectGeometry({
  kind,
  mats,
  eRef,
}: {
  kind: FloatKind;
  mats: Mats;
  eRef: RefObject<number>;
}) {
  const screenRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const e = eRef.current ?? 0;
    if (screenRef.current) screenRef.current.rotation.x = -0.34 * e;
  });

  switch (kind) {
    case "laptop":
      return (
        <group>
          <mesh material={mats.body} position={[0, -0.02, 0.02]} rotation={[-0.1, 0, 0]}>
            <boxGeometry args={[0.6, 0.05, 0.42]} />
          </mesh>
          <mesh material={mats.trim} position={[0, 0.008, 0.06]}>
            <boxGeometry args={[0.56, 0.01, 0.3]} />
          </mesh>
          <group ref={screenRef} position={[0, 0.06, -0.17]}>
            <mesh material={mats.body}>
              <boxGeometry args={[0.56, 0.35, 0.03]} />
            </mesh>
            <mesh material={mats.screenDark} position={[0, 0, 0.02]}>
              <boxGeometry args={[0.5, 0.29, 0.015]} />
            </mesh>
            <mesh material={mats.trim} position={[0, -0.12, 0.02]}>
              <boxGeometry args={[0.5, 0.012, 0.014]} />
            </mesh>
          </group>
        </group>
      );
    case "phone":
      return (
        <group>
          <mesh material={mats.screenDark}>
            <boxGeometry args={[0.17, 0.33, 0.04]} />
          </mesh>
          <mesh material={mats.trim} position={[0, 0.08, 0.023]}>
            <boxGeometry args={[0.11, 0.16, 0.01]} />
          </mesh>
          <mesh material={mats.metal} position={[0, -0.12, 0.022]}>
            <boxGeometry args={[0.09, 0.015, 0.01]} />
          </mesh>
        </group>
      );
    case "camera":
      return (
        <group>
          <mesh material={mats.body}>
            <boxGeometry args={[0.36, 0.26, 0.2]} />
          </mesh>
          <mesh material={mats.body} position={[0, 0.16, 0]}>
            <boxGeometry args={[0.24, 0.08, 0.18]} />
          </mesh>
          <mesh material={mats.metal} position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.07, 20]} />
          </mesh>
          <mesh material={mats.trim} position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.03, 20]} />
          </mesh>
          <mesh material={mats.screenDark} position={[0, 0.1, 0.11]}>
            <boxGeometry args={[0.15, 0.09, 0.01]} />
          </mesh>
        </group>
      );
    case "headphones":
      return (
        <group>
          <mesh material={mats.body} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.032, 10, 28, 0, Math.PI]} />
          </mesh>
          <EarCup side={1} mats={mats} eRef={eRef} />
          <EarCup side={-1} mats={mats} eRef={eRef} />
        </group>
      );
    case "tablet":
      return (
        <group>
          <mesh material={mats.body}>
            <boxGeometry args={[0.5, 0.34, 0.035]} />
          </mesh>
          <mesh material={mats.screenDark} position={[0, 0, 0.02]}>
            <boxGeometry args={[0.46, 0.3, 0.02]} />
          </mesh>
          <mesh material={mats.trim} position={[0, 0.05, 0.02]}>
            <boxGeometry args={[0.48, 0.014, 0.014]} />
          </mesh>
        </group>
      );
    case "keyboard":
      return (
        <group>
          <mesh material={mats.body}>
            <boxGeometry args={[0.6, 0.04, 0.2]} />
          </mesh>
          {[-0.06, 0, 0.06].map((z, i) => (
            <mesh key={z} material={mats.trim} position={[0, 0.026, z]}>
              <boxGeometry args={[0.52 - i * 0.06, 0.008, 0.045]} />
            </mesh>
          ))}
        </group>
      );
    case "book":
      return (
        <group>
          <mesh material={mats.body} rotation={[0, 0, -0.45]}>
            <boxGeometry args={[0.36, 0.028, 0.26]} />
          </mesh>
          <mesh material={mats.body} rotation={[0, 0, 0.45]}>
            <boxGeometry args={[0.36, 0.028, 0.26]} />
          </mesh>
          <mesh material={mats.trim} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.38, 10]} />
          </mesh>
          <mesh material={mats.trim} position={[0, 0.012, 0]}>
            <boxGeometry args={[0.3, 0.006, 0.2]} />
          </mesh>
        </group>
      );
    case "aiPanel":
      return (
        <group>
          <mesh material={mats.panelMat}>
            <boxGeometry args={[0.9, 0.58, 0.02]} />
          </mesh>
          <mesh material={mats.trim} position={[0, 0.3, 0]}>
            <boxGeometry args={[0.9, 0.014, 0.024]} />
          </mesh>
          <mesh material={mats.trim} position={[0, -0.3, 0]}>
            <boxGeometry args={[0.9, 0.014, 0.024]} />
          </mesh>
          <mesh material={mats.panelMat} position={[0, 0.08, 0.01]}>
            <boxGeometry args={[0.6, 0.015, 0.01]} />
          </mesh>
          <mesh material={mats.panelMat} position={[0, -0.08, 0.01]}>
            <boxGeometry args={[0.45, 0.015, 0.01]} />
          </mesh>
          <mesh material={mats.core} position={[0, 0, 0.01]}>
            <sphereGeometry args={[0.035, 10, 10]} />
          </mesh>
        </group>
      );
    case "cards":
      return (
        <group>
          {(
            [
              [-0.18, 0.1, 0.12, 0.6],
              [0.02, 0, 0, 0],
              [0.22, -0.12, -0.14, -0.5],
            ] as Array<[number, number, number, number]>
          ).map(([x, y, z, rot], i) => (
            <group key={i} position={[x, y, z]} rotation={[0, rot, 0.12 * i - 0.12]}>
              <mesh material={mats.body}>
                <boxGeometry args={[0.24, 0.32, 0.02]} />
              </mesh>
              <mesh material={mats.trim} position={[0, 0.12, 0.012]}>
                <boxGeometry args={[0.2, 0.014, 0.01]} />
              </mesh>
              <mesh material={mats.trim} position={[0, 0.05, 0.012]}>
                <boxGeometry args={[0.16, 0.05, 0.008]} />
              </mesh>
            </group>
          ))}
        </group>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* A single floating object — emerges, orbits, reacts to pointer       */
/* ------------------------------------------------------------------ */

function FloatObject({
  cfg,
  index,
  mats,
  spriteMat,
  openRef,
  pointerRef,
  hoveredRef,
  emergedRef,
  objectRefs,
  onHover,
  mobile,
  reduced,
}: {
  cfg: FloatCfg;
  index: number;
  mats: Mats;
  spriteMat: THREE.SpriteMaterial;
  openRef: RefObject<number>;
  pointerRef: RefObject<{ x: number; y: number }>;
  hoveredRef: RefObject<number>;
  emergedRef: RefObject<number[]>;
  objectRefs: RefObject<(THREE.Object3D | null)[]>;
  onHover: (index: number, on: boolean) => void;
  mobile: boolean;
  reduced: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const hoverS = useRef(0);
  const eRef = useRef(0);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const o = openRef.current;
    const e = smoothstep(o, cfg.start, cfg.end);
    eRef.current = e;
    if (emergedRef.current) emergedRef.current[index] = e;

    // spring the hover state
    const wantHover = hoveredRef.current === index ? 1 : 0;
    hoverS.current += (wantHover - hoverS.current) * (1 - Math.exp(-dt * 6));

    const grow = smoothstep(e, 0, 0.5);
    const act = smoothstep(e, 0.7, 1); // orbit/bob only after emerging

    const base = bezier3(cfg.from, cfg.mid, cfg.to, easeOutCubic(e));

    let y = base[1];
    if (!reduced) y += Math.sin(t * cfg.bobSpeed + cfg.orbitPhase) * cfg.bobAmp * act;

    const orbitA = cfg.orbitPhase + t * cfg.orbitSpeed;
    const orbX = Math.cos(orbitA) * cfg.orbitR * act;
    const orbZ = Math.sin(orbitA) * cfg.orbitR * act;

    const px = mobile || reduced ? 0 : pointerRef.current.x;
    const py = mobile || reduced ? 0 : pointerRef.current.y;
    const pull = hoverS.current * 0.28; // hovered object drifts toward the user

    const g = groupRef.current;
    if (g) {
      g.position.set(
        base[0] + orbX + px * cfg.par,
        y + py * cfg.par * 0.6,
        base[2] + orbZ + pull,
      );
      g.scale.setScalar(cfg.scale * (0.001 + grow) * (1 + hoverS.current * 0.08));
      g.rotation.y =
        cfg.rotY + (reduced ? 0 : t * cfg.spin * act) + (mobile || reduced ? 0 : pointerRef.current.x * 0.12);
      g.rotation.x = cfg.rotX + (mobile || reduced ? 0 : -pointerRef.current.y * 0.08);
      g.rotation.z = cfg.rotZ;
    }
    if (spriteRef.current) {
      spriteRef.current.scale.setScalar(hoverS.current * 1.7);
    }
  });

  const setHover = (on: boolean, e?: ThreeEvent<PointerEvent>) => {
    if (e) e.stopPropagation();
    onHover(index, on);
  };

  return (
    <group
      ref={(el) => {
        groupRef.current = el;
        if (objectRefs.current) objectRefs.current[index] = el;
      }}
      onPointerOver={(e) => setHover(true, e)}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e) => setHover(true, e)}
    >
      <ObjectGeometry kind={cfg.kind} mats={mats} eRef={eRef} />
      {/* hover glow (facing camera) */}
      <sprite ref={spriteRef} material={spriteMat} scale={0} />
      {/* invisible forgiving hit target */}
      <mesh>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Label projector — writes DOM label positions every frame            */
/* ------------------------------------------------------------------ */

function LabelProjector({
  objectRefs,
  labelRefs,
  hoveredRef,
  emergedRef,
  mobile,
}: {
  objectRefs: RefObject<(THREE.Object3D | null)[]>;
  labelRefs: RefObject<(HTMLDivElement | null)[]>;
  hoveredRef: RefObject<number>;
  emergedRef: RefObject<number[]>;
  mobile: boolean;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const w = size.width;
    const h = size.height;
    for (let i = 0; i < objectRefs.current.length; i++) {
      const el = labelRefs.current?.[i];
      const g = objectRefs.current?.[i];
      if (!el || !g) continue;
      const emerged = (emergedRef.current?.[i] ?? 0) > 0.45;
      g.getWorldPosition(v);
      v.project(camera);
      if (v.z > 1 || !emerged) {
        el.style.opacity = "0";
        continue;
      }
      const hovered = hoveredRef.current === i;
      const lx = Math.min(Math.max((v.x * 0.5 + 0.5) * w, 70), Math.max(70, w - 70));
      const ly = Math.min(Math.max((-v.y * 0.5 + 0.5) * h, 30), Math.max(30, h - 14));
      el.style.opacity = hovered ? "1" : mobile ? "0.45" : "0";
      el.style.transform = `translate3d(${lx}px, ${ly}px, 0) translate(-50%, -150%) scale(${hovered ? 1.06 : 1})`;
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* The device — geometry, spring, ambient motion                       */
/* ------------------------------------------------------------------ */

function DeviceScene({
  mobile,
  reduced,
  particleCount,
  wantOpen,
  onOpenChange,
  objectRefs,
  labelRefs,
  hoveredRef,
  emergedRef,
}: {
  mobile: boolean;
  reduced: boolean;
  particleCount: number;
  wantOpen: number;
  onOpenChange: (p: number) => void;
  objectRefs: RefObject<(THREE.Object3D | null)[]>;
  labelRefs: RefObject<(HTMLDivElement | null)[]>;
  hoveredRef: RefObject<number>;
  emergedRef: RefObject<number[]>;
}) {
  const { size } = useThree();
  const deviceRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const interiorRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const sweepRef = useRef<THREE.Mesh>(null);
  const pistonRef = useRef<THREE.Mesh>(null);
  const interiorLightRef = useRef<THREE.PointLight>(null);
  const railLRef = useRef<THREE.Mesh>(null);
  const railRRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const ledRefs = useRef<(THREE.Mesh | null)[]>([]);
  const openRef = useRef(0);
  const lastReport = useRef(-1);
  const pointerRef = useRef({ x: 0, y: 0 });
  const onOpenRef = useRef(onOpenChange);
  onOpenRef.current = onOpenChange;

  const cfgs = mobile ? FLOAT_CFG.slice(0, MOBILE_OBJECT_COUNT) : FLOAT_CFG;

  const mats = useMemo(() => createMaterials(), []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats],
  );

  // contact glow + shadow discs + hover-glow sprite material
  const { glowTex, shadowTex } = useMemo(() => {
    const glow = radialTexture([
      [0, "rgba(163,230,53,0.5)"],
      [0.35, "rgba(163,230,53,0.15)"],
      [1, "rgba(163,230,53,0)"],
    ]);
    const shadow = radialTexture([
      [0, "rgba(0,0,0,0.85)"],
      [0.5, "rgba(0,0,0,0.4)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    return { glowTex: glow, shadowTex: shadow };
  }, []);
  const spriteMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTex,
        color: LIME,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [glowTex],
  );
  useEffect(
    () => () => {
      glowTex.dispose();
      shadowTex.dispose();
      spriteMat.dispose();
    },
    [glowTex, shadowTex, spriteMat],
  );

  // floating particles around the device
  const particlesGeo = useMemo(() => {
    const count = particleCount;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.7 + Math.random() * 1.3;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.2 + Math.random() * 2.6;
      positions[i * 3 + 2] = Math.sin(a) * r * 0.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [particleCount]);
  useEffect(() => () => particlesGeo.dispose(), [particlesGeo]);

  // fit the device to the viewport: pull back on narrow (portrait) screens
  const aspect = size.width / Math.max(1, size.height);
  const deviceScale = Math.min(1, Math.max(0.6, aspect / 1.55));
  useEffect(() => {
    if (deviceRef.current) deviceRef.current.scale.setScalar(deviceScale);
  }, [deviceScale]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    pointerRef.current.x = state.pointer.x;
    pointerRef.current.y = state.pointer.y;

    // frame-rate independent spring toward the open target
    const k = 1 - Math.exp(-dt * (reduced ? 7 : 3.2));
    openRef.current += (wantOpen - openRef.current) * k;
    const open = openRef.current;
    if (Math.abs(open - lastReport.current) > 0.015) {
      lastReport.current = open;
      onOpenRef.current(open);
    }
    const lidP = smoothstep(open, 0, 0.32);
    const interiorP = smoothstep(open, 0.14, 0.55);
    const glowP = smoothstep(open, 0.25, 0.7);

    // device: float + rotate (+ hover parallax on desktop)
    const g = deviceRef.current;
    if (g) {
      if (reduced) {
        g.position.y = 0;
        g.rotation.y = 0.42;
        g.rotation.x = -open * 0.04;
        g.rotation.z = 0;
      } else {
        g.position.y = Math.sin(t * 0.7) * 0.1 * (1 - open * 0.45);
        const px = mobile ? 0 : state.pointer.x;
        const py = mobile ? 0 : state.pointer.y;
        g.rotation.y = t * 0.2 + px * 0.16;
        g.rotation.x = -open * 0.04 + py * 0.06;
        g.rotation.z = Math.sin(t * 0.45) * 0.02;
      }
    }

    // lid — lifts and unfolds on the rear hinge (fully open before emerge)
    if (lidRef.current) {
      lidRef.current.rotation.x = -(lidP * 1.83 + Math.sin(lidP * Math.PI) * 0.045);
    }

    // interior assembles; side rails slide apart; piston rises
    if (interiorRef.current) {
      interiorRef.current.scale.setScalar(0.001 + interiorP);
    }
    if (interiorLightRef.current) {
      interiorLightRef.current.intensity = glowP * 12;
    }
    if (railLRef.current) railLRef.current.position.x = -1.52 - interiorP * 0.06;
    if (railRRef.current) railRRef.current.position.x = 1.52 + interiorP * 0.06;
    if (pistonRef.current) {
      pistonRef.current.scale.y = 0.25 + glowP * 0.75;
    }

    // screen glow + beam + sweep line
    mats.screen.emissiveIntensity = 0.3 + glowP * 1.45 + Math.sin(t * 1.1) * 0.06;
    mats.beam.opacity = 0.05 + glowP * 0.17;
    if (beamRef.current) {
      beamRef.current.scale.setScalar(0.55 + glowP * 0.55 + Math.sin(t * 1.6) * 0.04);
    }
    if (sweepRef.current) {
      sweepRef.current.position.x = -0.5 + ((t * 0.14) % 1.0);
      mats.sweep.opacity = 0.55 * glowP;
    }

    // particles + light rings drift slowly
    if (particlesRef.current && !reduced) {
      particlesRef.current.rotation.y = t * 0.06;
      particlesRef.current.position.y = Math.sin(t * 0.5) * 0.06;
    }
    if (ringsRef.current && !reduced) {
      ringsRef.current.rotation.y = t * 0.24;
      ringsRef.current.rotation.x = 0.16 + Math.sin(t * 0.35) * 0.04;
    }

    // status LEDs pulse
    ledRefs.current.forEach((led, i) => {
      if (!led) return;
      led.scale.setScalar(0.75 + Math.sin(t * 2.4 + i * 1.6) * 0.35);
    });
  });

  return (
    <>
      <Env />
      <Rig mobile={mobile} reduced={reduced} />
      <ambientLight intensity={0.5} color="#e6eed8" />
      <pointLight position={[4, 5.5, 4]} intensity={60} distance={24} decay={2} color={LIME} />
      <pointLight position={[0, 4, -6]} intensity={24} distance={22} decay={2} color={LIME_SOFT} />
      <pointLight position={[0, 2.5, 6]} intensity={18} distance={20} decay={2} color={LIME_SOFT} />

      <group ref={deviceRef}>
        {/* contact shadow + glow */}
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.6, 4.0]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.0, 4.4]} />
          <meshBasicMaterial
            map={glowTex}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* ---------------- BASE ---------------- */}
        <RoundedBox w={3.0} h={0.9} d={2.0} r={0.16} material={mats.body} position={[0, 0.45, 0]} />
        {/* glowing bottom skirt */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[3.06, 0.07, 2.06]} />
          <meshBasicMaterial color={LIME} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* lime trim around the top of the body */}
        <mesh position={[0, 0.88, 0]} material={mats.trim}>
          <boxGeometry args={[3.02, 0.035, 2.02]} />
        </mesh>
        {/* polished side rails — slide apart as the machine opens */}
        <mesh ref={railLRef} position={[-1.52, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.metal}>
          <boxGeometry args={[0.88, 0.055, 2.0]} />
        </mesh>
        <mesh ref={railRRef} position={[1.52, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.metal}>
          <boxGeometry args={[0.88, 0.055, 2.0]} />
        </mesh>
        {/* ForgeX mark on the front */}
        <group position={[0, 0.45, 1.02]}>
          <mesh material={mats.trim} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.3, 0.045, 0.03]} />
          </mesh>
          <mesh material={mats.trim} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.3, 0.045, 0.03]} />
          </mesh>
        </group>
        {/* status LEDs */}
        {[-0.24, 0, 0.24].map((x, i) => (
          <mesh
            key={x}
            ref={(el) => {
              ledRefs.current[i] = el;
            }}
            position={[x, 0.1, 1.015]}
          >
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color={LIME} />
          </mesh>
        ))}

        {/* ---------------- INTERIOR (deck + bay) ---------------- */}
        <group ref={interiorRef} position={[0, 0.9, 0]} scale={0.001}>
          {/* deck plate */}
          <RoundedBox w={2.86} h={0.1} d={1.86} r={0.08} material={mats.dark} position={[0, 0.02, 0]} />
          {/* display band at the front of the deck */}
          <mesh material={mats.screen} position={[0, 0.08, 0.45]}>
            <boxGeometry args={[2.3, 0.05, 0.5]} />
          </mesh>
          <mesh position={[0, 0.105, 0.45]}>
            <boxGeometry args={[2.38, 0.016, 0.58]} />
            <meshBasicMaterial color={LIME} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* sweep line across the display */}
          <mesh ref={sweepRef} material={mats.sweep} position={[-0.5, 0.115, 0.45]}>
            <boxGeometry args={[0.5, 0.012, 0.5]} />
          </mesh>
          {/* central bay — objects emerge from here */}
          <RoundedBox w={1.5} h={0.16} d={1.1} r={0.07} material={mats.dark} position={[0, -0.02, -0.15]} />
          <mesh material={mats.trim} position={[0, 0.065, -0.15]}>
            <boxGeometry args={[1.56, 0.02, 1.16]} />
          </mesh>
          {/* core light inside the bay */}
          <mesh position={[0, 0.03, -0.15]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color={LIME_SOFT} />
          </mesh>
          {/* telescoping piston */}
          <mesh ref={pistonRef} material={mats.metal} position={[0, 0.12, -0.15]}>
            <cylinderGeometry args={[0.045, 0.055, 0.4, 10]} />
          </mesh>
          <pointLight ref={interiorLightRef} position={[0, 0.35, -0.15]} intensity={0} distance={6} decay={2} color={LIME} />
          {/* light beam rising from the bay */}
          <mesh ref={beamRef} material={mats.beam} position={[0, 1.72, -0.15]}>
            <coneGeometry args={[0.55, 1.5, 24, 1, true]} />
          </mesh>
        </group>

        {/* ---------------- LID (rear hinge, swings up) ---------------- */}
        <group position={[0, 0.9, -0.86]} ref={lidRef}>
          {/* polished hinge pin */}
          <mesh material={mats.metal} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 2.8, 12]} />
          </mesh>
          <RoundedBox w={2.8} h={0.5} d={1.72} r={0.12} material={mats.body} position={[0, 0.26, 0.86]} />
          {/* inner lime trim (visible when open) */}
          <mesh material={mats.trim} position={[0, 0.09, 0.86]}>
            <boxGeometry args={[2.78, 0.02, 1.7]} />
          </mesh>
          {/* glossy outer strip */}
          <mesh material={mats.gloss} position={[0, 0.47, 0.86]}>
            <boxGeometry args={[2.76, 0.03, 1.68]} />
          </mesh>
        </group>

        {/* ---------------- FLOATING OBJECTS (emerge from the bay) ---------------- */}
        {cfgs.map((c, i) => (
          <FloatObject
            key={c.id}
            cfg={c}
            index={i}
            mats={mats}
            spriteMat={spriteMat}
            openRef={openRef}
            pointerRef={pointerRef}
            hoveredRef={hoveredRef}
            emergedRef={emergedRef}
            objectRefs={objectRefs}
            onHover={(idx, on) => {
              hoveredRef.current = on ? idx : -1;
            }}
            mobile={mobile}
            reduced={reduced}
          />
        ))}

        {/* ---------------- particles + light trails ---------------- */}
        <points ref={particlesRef} geometry={particlesGeo}>
          <pointsMaterial
            size={0.05}
            color={LIME}
            transparent
            opacity={mobile ? 0.4 : 0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
          />
        </points>
        <group ref={ringsRef}>
          <mesh rotation={[1.18, 0, 0]} material={mats.ringA}>
            <torusGeometry args={[2.5, 0.013, 8, 80]} />
          </mesh>
          {!mobile && (
            <mesh rotation={[1.5, 0, 0.8]} material={mats.ringB}>
              <torusGeometry args={[3.0, 0.011, 8, 80]} />
            </mesh>
          )}
        </group>
      </group>

      <LabelProjector
        objectRefs={objectRefs}
        labelRefs={labelRefs}
        hoveredRef={hoveredRef}
        emergedRef={emergedRef}
        mobile={mobile}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Animated SVG fallback (iOS + no-WebGL) — same interaction           */
/* ------------------------------------------------------------------ */

const FALLBACK_PARTICLES = Array.from({ length: 10 }, () => ({
  x: 60 + Math.random() * 300,
  y: 40 + Math.random() * 220,
  r: 1 + Math.random() * 1.6,
}));

function FallbackShape({ kind }: { kind: string }) {
  switch (kind) {
    case "laptop":
      return (
        <>
          <rect x={-28} y={-4} width="56" height="10" rx="3" fill="#161a21" stroke="#333a44" strokeWidth="1" />
          <rect x={-24} y={-1} width="48" height="3" fill={LIME} opacity="0.8" />
          <rect x={-26} y={-30} width="52" height="26" rx="2" fill="#11151b" stroke="#333a44" strokeWidth="1" />
          <rect x={-22} y={-27} width="44" height="20" rx="1" fill="#07090c" />
          <rect x={-22} y={-10} width="44" height="2.5" fill={LIME} opacity="0.7" />
        </>
      );
    case "phone":
      return (
        <>
          <rect x={-8} y={-22} width="16" height="44" rx="4" fill="#07090c" stroke="#2c323b" strokeWidth="1.2" />
          <rect x={-5} y={-17} width="10" height="26" rx="1" fill={LIME} opacity="0.55" />
          <rect x={-5} y={12} width="10" height="3" rx="1.5" fill="#3a414c" />
        </>
      );
    case "panel":
      return (
        <>
          <rect x={-36} y={-22} width="72" height="44" rx="6" fill={LIME} opacity="0.12" stroke={LIME} strokeOpacity="0.5" strokeWidth="1.2" />
          <rect x={-30} y={-14} width="60" height="4" rx="2" fill={LIME} opacity="0.7" />
          <rect x={-30} y={-4} width="46" height="3" rx="1.5" fill={LIME} opacity="0.55" />
          <circle cx="0" cy="8" r="4" fill={LIME} opacity="0.9" />
        </>
      );
    case "book":
      return (
        <>
          <rect x={-24} y={-9} width="24" height="18" rx="2" fill="#161a21" stroke="#333a44" strokeWidth="1" transform="rotate(-14)" />
          <rect x={0} y={-9} width="24" height="18" rx="2" fill="#161a21" stroke="#333a44" strokeWidth="1" transform="rotate(14)" />
          <rect x={-2} y={-8} width="4" height="16" rx="1" fill={LIME} opacity="0.85" />
        </>
      );
    case "camera":
      return (
        <>
          <rect x={-20} y={-12} width="40" height="24" rx="5" fill="#161a21" stroke="#333a44" strokeWidth="1" />
          <rect x={-12} y={-17} width="24" height="8" rx="3" fill="#161a21" stroke="#333a44" strokeWidth="1" />
          <circle cx="0" cy="0" r="8" fill="#07090c" stroke="#3a414c" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="4.5" fill={LIME} opacity="0.8" />
        </>
      );
    default:
      return null;
  }
}

const FALLBACK_OBJS = [
  { id: "laptop", label: "LEARN", kind: "laptop", tx: 128, ty: 112, start: 0.35, end: 0.6 },
  { id: "phone", label: "CONNECT", kind: "phone", tx: 76, ty: 168, start: 0.4, end: 0.65 },
  { id: "ai", label: "AI", kind: "panel", tx: 210, ty: 58, start: 0.45, end: 0.72 },
  { id: "book", label: "KNOWLEDGE", kind: "book", tx: 322, ty: 122, start: 0.5, end: 0.78 },
  { id: "camera", label: "CREATE", kind: "camera", tx: 346, ty: 196, start: 0.55, end: 0.85 },
];

function StaticFallback({ progress, reduced }: { progress: number; reduced: boolean }) {
  const open = clamp01(progress);
  const easing = [0.22, 1, 0.36, 1] as const;

  return (
    <div className="h-80 w-full select-none overflow-hidden sm:h-[30rem] lg:h-[33rem]">
      <svg
        viewBox="0 0 420 320"
        className="h-full w-full"
        role="img"
        aria-label="ForgeX Learning Device — a futuristic matte-black and electric-lime learning machine that opens and releases laptops, phones, cameras, books and AI panels"
      >
        <defs>
          <radialGradient id="fxd-ambient" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={LIME} stopOpacity="0.14" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fxd-deck" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LIME} stopOpacity="0.5" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="fxd-beam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={LIME} stopOpacity="0.45" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ambient glow */}
        <ellipse cx="210" cy="150" rx="200" ry="130" fill="url(#fxd-ambient)" />

        {/* drifting particles */}
        {FALLBACK_PARTICLES.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={LIME}
            initial={false}
            animate={reduced ? { opacity: 0.3 } : { y: [p.y, p.y - 14, p.y], opacity: [0.12, 0.4, 0.12] }}
            transition={{ duration: 4 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          />
        ))}

        {/* floating machine */}
        <motion.g
          initial={false}
          animate={reduced ? undefined : { y: [0, -7, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* floor shadow + glow */}
          <ellipse cx="210" cy="252" rx="105" ry="16" fill="#000" opacity="0.55" />
          <ellipse cx="210" cy="250" rx="118" ry="20" fill={LIME} opacity="0.1" />

          {/* base body */}
          <rect x="135" y="150" width="150" height="86" rx="14" fill="#101318" stroke="#2a3038" strokeWidth="1.5" />

          {/* deck glow — revealed when open */}
          <motion.g initial={false} animate={{ opacity: open }} transition={{ duration: 0.6 }}>
            <rect x="141" y="134" width="138" height="16" fill="url(#fxd-deck)" />
            <rect x="141" y="148" width="138" height="2.5" fill={LIME} opacity="0.8" />
          </motion.g>

          {/* rising light beam */}
          <motion.g initial={false} animate={{ opacity: open }} transition={{ duration: 0.5 }}>
            <rect x="206" y="94" width="8" height="42" rx="4" fill="url(#fxd-beam)" />
          </motion.g>

          {/* base trims, rails, mark, LEDs */}
          <rect x="135" y="228" width="150" height="5" rx="2.5" fill={LIME} opacity="0.65" />
          <rect x="135" y="152" width="4" height="70" rx="2" fill="#2e343d" />
          <rect x="281" y="152" width="4" height="70" rx="2" fill="#2e343d" />
          <path d="M202 187 L218 203 M218 187 L202 203" stroke={LIME} strokeWidth="4" strokeLinecap="round" />
          {[-18, 0, 18].map((dx, i) => (
            <motion.circle
              key={dx}
              cx={210 + dx}
              cy={218}
              r="2"
              fill={LIME}
              initial={false}
              animate={reduced ? { opacity: 0.8 } : { opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            />
          ))}

          {/* lid — opens on the rear hinge (bottom-right) */}
          <motion.g
            initial={false}
            animate={{ rotate: open * 105 }}
            transition={{ duration: 1.3, ease: easing }}
            style={{ originX: 1, originY: 1, transformBox: "fill-box" }}
          >
            <rect x="135" y="132" width="150" height="18" rx="9" fill="#1a1e24" stroke="#30363f" strokeWidth="1.5" />
            <rect x="137" y="146" width="146" height="3" rx="1.5" fill={LIME} opacity="0.75" />
            <rect x="137" y="132" width="146" height="3.5" rx="1.75" fill="#464d58" />
          </motion.g>
        </motion.g>

        {/* emerging objects — rise from the machine and float out */}
        {FALLBACK_OBJS.map((o) => {
          const e = smoothstep(open, o.start, o.end);
          const grow = smoothstep(e, 0, 0.35);
          const x = 210 + (o.tx - 210) * e;
          const y = 150 + (o.ty - 150) * e - Math.sin(e * Math.PI) * 46;
          const opacity = smoothstep(e, 0.05, 0.4);
          const s = 0.5 + 0.5 * grow;
          return (
            <g
              key={o.id}
              transform={`translate(${x} ${y}) scale(${s})`}
              opacity={opacity}
              style={{ transformBox: "fill-box" }}
            >
              <motion.g
                initial={false}
                animate={reduced ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: o.start }}
              >
                <FallbackShape kind={o.kind} />
                <text
                  y={-26}
                  textAnchor="middle"
                  fontSize="9"
                  fill={LIME}
                  fillOpacity="0.85"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                  letterSpacing="1.5"
                >
                  {o.label}
                </text>
              </motion.g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error boundary — if WebGL/Three fails at runtime, show the fallback */
/* ------------------------------------------------------------------ */

class SceneErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error("[ForgeX 3D] scene failed:", err);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Small DOM chrome                                                    */
/* ------------------------------------------------------------------ */

function Eyebrow() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-lime-400/60" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-lime-300/90">
        ForgeX Learning Device
      </p>
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-lime-400/60" />
    </div>
  );
}

function Hint({ mobile }: { mobile: boolean }) {
  return (
    <p className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/50">
      {mobile ? "Scroll or tap to open the device" : "Scroll or hover to open the device"}
    </p>
  );
}

function PhaseStepper({ active, progress }: { active: number; progress: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 pb-3">
      <div className="flex items-center gap-3">
        {PHASES.map((p, i) => (
          <div key={p.key} className="flex items-center gap-3">
            {i > 0 && (
              <span
                className={`h-px w-5 transition-colors duration-300 sm:w-10 ${
                  active >= i ? "bg-lime-400/70" : "bg-white/15"
                }`}
              />
            )}
            <span
              className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors duration-300 ${
                active === i ? "text-lime-300" : "text-muted-foreground/50"
              }`}
            >
              <span
                className={`size-1.5 rounded-full transition-colors duration-300 ${
                  active >= i ? "bg-lime-400" : "bg-white/25"
                }`}
              />
              {p.label}
            </span>
          </div>
        ))}
      </div>
      <div className="h-px w-40 overflow-hidden rounded-full bg-white/10 sm:w-56">
        <div
          className="h-full bg-lime-400 transition-[width] duration-200 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

const PHASES = [
  { key: "discover", label: "Discover" },
  { key: "express", label: "Express" },
  { key: "build", label: "Build" },
];

function Loader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="size-8 animate-pulse rounded-full border-2 border-lime-400/30 border-t-lime-400" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */

export function ForgeXLearningDevice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const objectRefs = useRef<(THREE.Object3D | null)[]>([]);
  const emergedRef = useRef<number[]>([]);
  const hoveredRef = useRef(-1);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [scrollP, setScrollP] = useState(0);
  const [openP, setOpenP] = useState(0);

  useEffect(() => {
    // Never create a WebGL context on iOS — the animated SVG fallback is
    // used there so the page can't be taken down by a GPU-process crash.
    setWebgl(!isIOS() && webglAvailable());
    setReduced(prefersReducedMotion());
    setMobile(isCoarsePointer());

    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { rootMargin: "160px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // scroll-reactive opening: the sequence plays as you scroll past the device
  useEffect(() => {
    const onScroll = () => {
      setScrollP(clamp01((window.scrollY - 160) / 520));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const wantOpen = Math.max(scrollP, interacted ? 1 : 0, tapped ? 1 : 0);
  const phase = openP < 0.06 ? 0 : openP < 0.94 ? 1 : 2;
  const cfgs = mobile ? FLOAT_CFG.slice(0, MOBILE_OBJECT_COUNT) : FLOAT_CFG;

  const interactionHandlers = {
    onPointerEnter: () => {
      if (!mobile) setInteracted(true);
    },
    onPointerLeave: () => {
      if (!mobile) setInteracted(false);
    },
    onPointerDown: () => {
      if (mobile) setTapped((t) => !t);
    },
  };

  if (webgl === false) {
    // No WebGL means no Canvas, so openP never updates — drive the stepper
    // straight from the interaction target instead.
    const fallbackPhase = wantOpen < 0.06 ? 0 : wantOpen < 0.94 ? 1 : 2;
    return (
      <div ref={containerRef} className="mx-auto mt-12 w-full max-w-5xl sm:mt-16">
        <Eyebrow />
        <div className="mt-4">
          <Hint mobile={mobile} />
          <div className="relative" {...interactionHandlers}>
            <StaticFallback progress={wantOpen} reduced={reduced} />
            <PhaseStepper active={fallbackPhase} progress={wantOpen} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mx-auto mt-12 w-full max-w-5xl sm:mt-16">
      <Eyebrow />
      <div className="mt-4">
        <Hint mobile={mobile} />
        <div
          className="relative overflow-hidden"
          {...interactionHandlers}
          aria-label="Interactive 3D ForgeX Learning Device"
        >
          {/* soft lime ambience behind the device */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(46% 42% at 50% 46%, rgba(163,230,53,0.10), transparent 70%)",
            }}
          />

          <div className="relative h-80 w-full select-none sm:h-[30rem] lg:h-[33rem]">
            {webgl === null ? (
              <Loader />
            ) : (
              <SceneErrorBoundary fallback={<StaticFallback progress={wantOpen} reduced={reduced} />}>
                <Canvas
                  dpr={mobile ? [1, 1.5] : [1, 2]}
                  frameloop={visible ? "always" : "never"}
                  camera={{ position: [0, 1.78, 7.4], fov: 38 }}
                  gl={{ antialias: true, alpha: true }}
                  style={{ touchAction: "pan-y" }}
                >
                  <DeviceScene
                    mobile={mobile}
                    reduced={reduced}
                    particleCount={mobile ? 16 : 40}
                    wantOpen={wantOpen}
                    onOpenChange={setOpenP}
                    objectRefs={objectRefs}
                    labelRefs={labelRefs}
                    hoveredRef={hoveredRef}
                    emergedRef={emergedRef}
                  />
                </Canvas>
              </SceneErrorBoundary>
            )}
          </div>

          {/* object labels — DOM overlays projected onto the 3D objects */}
          {cfgs.map((c, i) => (
            <div
              key={c.id}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap rounded-full border border-lime-400/40 bg-[#0d0f0c]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-lime-200 backdrop-blur"
              style={{
                opacity: 0,
                transform: "translate(-50%, -150%)",
                willChange: "transform, opacity",
              }}
            >
              <span className="mr-1.5 inline-block size-1 rounded-full bg-lime-400 align-middle" />
              {c.label}
            </div>
          ))}

          <PhaseStepper active={phase} progress={openP} />
        </div>
      </div>
    </div>
  );
}
