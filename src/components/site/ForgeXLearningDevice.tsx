/**
 * FORGEX LEARNING DEVICE — the interactive 3D centerpiece of the homepage.
 *
 * A compact matte-black + electric-lime futuristic learning device. Closed on
 * load, it slowly floats and rotates in space. As the visitor scrolls (or
 * hovers / taps it) the lid smoothly swings open on a rear hinge, revealing a
 * glowing holographic learning interface — course modules, an AI core, a
 * creative spark and a community ring — with soft lime light emitted from
 * inside, drifting particles and orbiting light trails.
 *
 * The three act narrative maps onto the hero headline:
 *   DISCOVER → the device is closed, floating and rotating
 *   EXPRESS  → the lid opens, the interface is revealed
 *   BUILD    → the interface activates, the device rotates to show its depth
 *
 * Built from Three.js primitives + RoundedBoxGeometry (no external models,
 * no drei). Performance-minded:
 *  - no shadow maps, no post-processing, tiny particle counts
 *  - device pixel ratio capped (lower on touch devices)
 *  - rendering pauses when the canvas leaves the viewport
 *  - reduced particles + a single light ring on mobile
 *  - prefers-reduced-motion disables ambient animation (float/rotation/trails)
 *  - iOS/iPadOS (WebKit — includes Chrome on iOS) never creates a WebGL
 *    context: it uses the animated SVG fallback instead, so a GPU-process
 *    crash can never reload the page. The fallback keeps the same open/close
 *    interaction (scroll, hover, tap).
 *  - animated SVG fallback if WebGL is unavailable anywhere else
 */
import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/* Palette & shared constants                                          */
/* ------------------------------------------------------------------ */

const LIME = "#a3e635";
const LIME_SOFT = "#d9f99d";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const smoothstep = (v: number, a: number, b: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Holographic UI chips revealed inside the device when it opens. */
const CHIP_CFG = [
  { id: "course", x: -0.62, z: -0.3, rise: 0.62, phase: 0 },
  { id: "layers", x: -0.3, z: 0.04, rise: 0.85, phase: 1.4 },
  { id: "core", x: 0, z: 0.28, rise: 1.05, phase: 2.8 },
  { id: "spark", x: 0.32, z: 0.02, rise: 0.8, phase: 4.2 },
  { id: "community", x: 0.64, z: -0.3, rise: 0.58, phase: 5.6 },
];

const PHASES = [
  { key: "discover", label: "Discover" },
  { key: "express", label: "Express" },
  { key: "build", label: "Build" },
];

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
 * entirely and show the animated SVG device instead.
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

type Mats = {
  body: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  metal: THREE.MeshPhysicalMaterial;
  gloss: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  chip: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  screen: THREE.MeshStandardMaterial;
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
    // polished side rails / hinge
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
    // holographic chips
    chip: new THREE.MeshStandardMaterial({
      color: "#1b2116",
      emissive: new THREE.Color(LIME),
      emissiveIntensity: 1.55,
      transparent: true,
      opacity: 0.95,
    }),
    // bright core / spark
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
/* Camera rig — gentle parallax, no orbiting                          */
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
/* Holographic chip shapes                                             */
/* ------------------------------------------------------------------ */

function ChipShape({ id, mats }: { id: string; mats: Mats }) {
  switch (id) {
    case "course":
      // open book — courses & lessons
      return (
        <group>
          <mesh material={mats.chip} position={[0, 0.02, 0]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.17, 0.022, 0.11]} />
          </mesh>
          <mesh material={mats.chip} position={[0, 0.02, 0]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.17, 0.022, 0.11]} />
          </mesh>
          <mesh material={mats.metal} position={[0, 0.015, 0]}>
            <boxGeometry args={[0.03, 0.025, 0.12]} />
          </mesh>
        </group>
      );
    case "layers":
      // stacked modules — learning modules
      return (
        <group>
          {[0, 0.036, 0.072].map((y) => (
            <mesh key={y} material={mats.chip} position={[0, y, 0]}>
              <boxGeometry args={[0.16 - y * 0.45, 0.018, 0.16 - y * 0.45]} />
            </mesh>
          ))}
        </group>
      );
    case "core":
      // AI core
      return (
        <mesh material={mats.core}>
          <octahedronGeometry args={[0.085, 0]} />
        </mesh>
      );
    case "spark":
      // creativity spark
      return (
        <mesh material={mats.core}>
          <tetrahedronGeometry args={[0.09, 0]} />
        </mesh>
      );
    case "community":
      // community ring
      return (
        <group>
          <mesh material={mats.chip} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.085, 0.015, 8, 24]} />
          </mesh>
          <mesh material={mats.core} position={[0, 0, 0.085]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.012, 8, 20]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* The device — geometry, springs, ambient motion                      */
/* ------------------------------------------------------------------ */

function DeviceScene({
  mobile,
  reduced,
  particleCount,
  wantOpen,
  onOpenChange,
}: {
  mobile: boolean;
  reduced: boolean;
  particleCount: number;
  wantOpen: boolean;
  onOpenChange: (p: number) => void;
}) {
  const { size } = useThree();
  const deviceRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const interiorRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const sweepRef = useRef<THREE.Mesh>(null);
  const interiorLightRef = useRef<THREE.PointLight>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const ledRefs = useRef<(THREE.Mesh | null)[]>([]);
  const chipRefs = useRef<(THREE.Group | null)[]>([]);
  const openRef = useRef(0);
  const lastReport = useRef(-1);
  const onOpenRef = useRef(onOpenChange);
  onOpenRef.current = onOpenChange;

  const mats = useMemo(() => createMaterials(), []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats],
  );

  // floating particles around the device
  const particlesGeo = useMemo(() => {
    const count = particleCount;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.6 + Math.random() * 1.2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.2 + Math.random() * 2.0;
      positions[i * 3 + 2] = Math.sin(a) * r * 0.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [particleCount]);
  useEffect(() => () => particlesGeo.dispose(), [particlesGeo]);

  // contact glow + shadow discs
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
  useEffect(
    () => () => {
      glowTex.dispose();
      shadowTex.dispose();
    },
    [glowTex, shadowTex],
  );

  // fit the device to the viewport: pull back on narrow (portrait) screens
  const aspect = size.width / Math.max(1, size.height);
  const deviceScale = Math.min(1, Math.max(0.6, aspect / 1.55));
  useEffect(() => {
    if (deviceRef.current) deviceRef.current.scale.setScalar(deviceScale);
  }, [deviceScale]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // frame-rate independent spring toward the open target
    const k = 1 - Math.exp(-dt * (reduced ? 7 : 3.2));
    openRef.current += ((wantOpen ? 1 : 0) - openRef.current) * k;
    const open = openRef.current;
    if (Math.abs(open - lastReport.current) > 0.015) {
      lastReport.current = open;
      onOpenRef.current(open);
    }
    const interiorP = smoothstep(open, 0.12, 0.78);
    const buildP = smoothstep(open, 0.5, 1);

    // device: float + rotate (+ hover parallax on desktop)
    const g = deviceRef.current;
    if (g) {
      if (reduced) {
        g.position.y = 0;
        g.rotation.y = 0.42;
        g.rotation.x = -open * 0.05;
        g.rotation.z = 0;
      } else {
        g.position.y = Math.sin(t * 0.7) * 0.11 * (1 - open * 0.45);
        const px = mobile ? 0 : state.pointer.x;
        const py = mobile ? 0 : state.pointer.y;
        g.rotation.y = t * (open > 0.8 ? 0.26 : 0.2) + px * 0.16;
        g.rotation.x = -open * 0.05 + py * 0.06;
        g.rotation.z = Math.sin(t * 0.45) * 0.02;
      }
    }

    // lid — swings open on the rear hinge with a soft overshoot
    if (lidRef.current) {
      lidRef.current.rotation.x =
        open * 1.83 + Math.sin(Math.min(open, 1) * Math.PI) * 0.045;
    }

    // interior — assembles as the lid opens
    if (interiorRef.current) {
      interiorRef.current.scale.setScalar(0.001 + interiorP);
    }
    if (interiorLightRef.current) {
      interiorLightRef.current.intensity = interiorP * 10;
    }

    // chips — rise and spin once the device is mostly open (BUILD)
    chipRefs.current.forEach((chip, i) => {
      if (!chip) return;
      const c = CHIP_CFG[i];
      const rise = buildP;
      let y = 0.94 + c.rise * rise;
      if (!reduced) y += Math.sin(t * 1.3 + c.phase) * 0.028 * rise;
      chip.position.set(c.x, y, c.z);
      const s = 0.001 + rise;
      chip.scale.setScalar(s);
      chip.rotation.y = reduced ? c.phase : t * 0.45 + c.phase;
    });

    // screen glow + beam + sweep line
    mats.screen.emissiveIntensity =
      0.3 + interiorP * 1.45 + Math.sin(t * 1.1) * 0.06;
    mats.beam.opacity = 0.06 + interiorP * 0.15;
    if (beamRef.current) {
      beamRef.current.scale.setScalar(
        0.55 + interiorP * 0.5 + Math.sin(t * 1.6) * 0.04,
      );
    }
    if (sweepRef.current) {
      sweepRef.current.position.x = -0.6 + ((t * 0.14) % 1.2);
      mats.sweep.opacity = 0.55 * interiorP;
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

      <group ref={deviceRef}>
        {/* contact shadow + glow */}
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.3, 3.6]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.6, 3.9]} />
          <meshBasicMaterial
            map={glowTex}
            transparent
            opacity={0.55}
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
        {/* polished side rails */}
        <mesh position={[1.52, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.metal}>
          <boxGeometry args={[0.88, 0.055, 2.0]} />
        </mesh>
        <mesh position={[-1.52, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.metal}>
          <boxGeometry args={[0.88, 0.055, 2.0]} />
        </mesh>
        {/* ForgeX mark on the front */}
        <group position={[0, 0.45, -1.02]}>
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
            position={[x, 0.1, -1.015]}
          >
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color={LIME} />
          </mesh>
        ))}

        {/* ---------------- INTERIOR (deck + holographics) ---------------- */}
        <group ref={interiorRef} position={[0, 0.9, 0]} scale={0.001}>
          {/* deck plate */}
          <RoundedBox w={2.86} h={0.1} d={1.86} r={0.08} material={mats.dark} position={[0, 0.02, 0]} />
          {/* display panel */}
          <mesh material={mats.screen} position={[0, 0.09, 0]}>
            <boxGeometry args={[1.7, 0.05, 1.05]} />
          </mesh>
          {/* display frame */}
          <mesh position={[0, 0.115, 0]}>
            <boxGeometry args={[1.82, 0.02, 1.17]} />
            <meshBasicMaterial color={LIME} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* UI cards on the display */}
          {[-0.42, 0, 0.42].map((x) => (
            <mesh key={x} material={mats.trim} position={[x, 0.115, 0]}>
              <boxGeometry args={[0.3, 0.018, 0.22]} />
            </mesh>
          ))}
          {/* sweep line */}
          <mesh ref={sweepRef} material={mats.sweep} position={[-0.6, 0.125, 0]}>
            <boxGeometry args={[0.5, 0.012, 1.06]} />
          </mesh>
          {/* holographic chips */}
          {CHIP_CFG.map((c, i) => (
            <group
              key={c.id}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              position={[c.x, 0.94, c.z]}
              scale={0.001}
            >
              {/* projection pylon */}
              <mesh position={[0, -0.45, 0]}>
                <cylinderGeometry args={[0.011, 0.02, 0.9, 6]} />
                <meshBasicMaterial color={LIME} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
              <ChipShape id={c.id} mats={mats} />
            </group>
          ))}
          {/* light beam rising from the display */}
          <mesh ref={beamRef} material={mats.beam} position={[0, 1.67, 0]}>
            <coneGeometry args={[0.55, 1.5, 24, 1, true]} />
          </mesh>
          {/* core light + interior glow */}
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshBasicMaterial color={LIME_SOFT} />
          </mesh>
          <pointLight ref={interiorLightRef} position={[0, 0.5, 0]} intensity={0} distance={6} decay={2} color={LIME} />
        </group>

        {/* ---------------- LID (rear hinge) ---------------- */}
        <group position={[0, 0.9, 0.86]} ref={lidRef}>
          {/* polished hinge pin */}
          <mesh material={mats.metal} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 2.8, 12]} />
          </mesh>
          <RoundedBox w={2.8} h={0.5} d={1.72} r={0.12} material={mats.body} position={[0, 0.26, -0.86]} />
          {/* inner lime trim (visible when open) */}
          <mesh material={mats.trim} position={[0, 0.09, -0.86]}>
            <boxGeometry args={[2.78, 0.02, 1.7]} />
          </mesh>
          {/* glossy outer strip */}
          <mesh material={mats.gloss} position={[0, 0.47, -0.86]}>
            <boxGeometry args={[2.76, 0.03, 1.68]} />
          </mesh>
        </group>

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
            <torusGeometry args={[2.35, 0.013, 8, 80]} />
          </mesh>
          {!mobile && (
            <mesh rotation={[1.5, 0, 0.8]} material={mats.ringB}>
              <torusGeometry args={[2.85, 0.011, 8, 80]} />
            </mesh>
          )}
        </group>
      </group>
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

const CHIPS_2D = [
  { id: "course", x: 188 },
  { id: "core", x: 210 },
  { id: "spark", x: 232 },
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
        aria-label="ForgeX Learning Device — a futuristic matte-black and electric-lime learning device whose lid opens to reveal a glowing learning interface"
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

        {/* floating device */}
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

          {/* holographic chips */}
          {CHIPS_2D.map((c, i) => (
            <motion.g
              key={c.id}
              initial={false}
              animate={{ opacity: open, y: open ? c.x < 210 ? -30 : -26 : -4 }}
              transition={{ duration: 0.7, delay: 0.3 + i * 0.12, ease: easing }}
            >
              <rect x={c.x - 8} y={138} width="16" height="12" rx="3" fill="#0c0f0a" stroke={LIME} strokeOpacity="0.7" strokeWidth="1" />
              <circle cx={c.x} cy={144} r="2" fill={LIME} />
            </motion.g>
          ))}

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

function PhaseStepper({
  active,
  progress,
}: {
  active: number;
  progress: number;
}) {
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

  // scroll-reactive opening: the device opens as you scroll past it
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
                    wantOpen={wantOpen > 0.02}
                    onOpenChange={setOpenP}
                  />
                </Canvas>
              </SceneErrorBoundary>
            )}
          </div>

          <PhaseStepper active={phase} progress={openP} />
        </div>
      </div>
    </div>
  );
}
