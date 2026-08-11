/**
 * FORGEX LEARNING COMMUNITY — a lightweight interactive 3D campus for the
 * homepage hero. Six spaces (Learning Hub, Study Lab, Knowledge Hub, Mentor
 * Space, Creator Space, Community Hall) around a central plaza with paths,
 * tiny trees and pulsing activity lights.
 *
 * Built on React Three Fiber + Three.js primitives only (no models, no drei).
 * Performance-minded:
 *  - capped device pixel ratio (lower on touch devices)
 *  - no shadows, no post-processing, very few particles
 *  - rendering pauses when the canvas leaves the viewport
 *  - prefers-reduced-motion disables ambient animation
 *  - static (but still animated) SVG fallback if WebGL is unavailable
 *
 * Motion is clearly visible: the whole campus rotates gently on its axis,
 * buildings bob, activity lights pulse and the camera drifts. Every space
 * carries a small always-on name label above it; hover/tap makes a space
 * glow and highlights its label.
 */
import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

// ForgeX palette
const LIME = "#a3e635";
const DARK = "#0d0f0c";
const GLASS = "#0b0e09";
const FRAME = "#1a1f13";
const PATH = "#151a10";

const RADIUS = 6; // ring radius for the six spaces
const PLAZA_R = 2.35;

type Shape = "tower" | "stepped" | "block" | "prism" | "dome";

type BuildingCfg = {
  id: string;
  name: string;
  shape: Shape;
  h: number;
  w: number;
  d: number;
  angle: number; // degrees around the plaza
};

const BUILDINGS: BuildingCfg[] = [
  { id: "hub", name: "Learning Hub", shape: "tower", h: 3.1, w: 1.5, d: 1.5, angle: 0 },
  { id: "lab", name: "Study Lab", shape: "stepped", h: 1.7, w: 2.5, d: 1.5, angle: 60 },
  { id: "knowledge", name: "Knowledge Hub", shape: "tower", h: 2.5, w: 1.4, d: 1.4, angle: 120 },
  { id: "mentor", name: "Mentor Space", shape: "block", h: 1.9, w: 1.9, d: 1.9, angle: 180 },
  { id: "creator", name: "Creator Space", shape: "prism", h: 1.8, w: 1.7, d: 1.7, angle: 240 },
  { id: "community", name: "Community Hall", shape: "dome", h: 1.6, w: 2.3, d: 2.3, angle: 300 },
];

// Tree ring angles — placed between buildings
const TREE_ANGLES = [30, 92, 152, 212, 272, 330];

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
 * which reads as "the app keeps refreshing". We skip the 3D canvas entirely
 * on iOS and show the animated SVG campus instead — the page stays rock
 * solid while desktop/Android keep the full 3D experience.
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
/* 3D building                                                         */
/* ------------------------------------------------------------------ */

function Building({
  cfg,
  phase,
  reduced,
  onHoverChange,
  storeRef,
}: {
  cfg: BuildingCfg;
  phase: number;
  reduced: boolean;
  onHoverChange: (info: { name: string; target: THREE.Object3D } | null) => void;
  storeRef?: (g: THREE.Group | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const hoveredRef = useRef(false);

  // Per-building materials so hover can gently brighten one space only.
  const mats = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: GLASS,
      metalness: 0.35,
      roughness: 0.28,
      transparent: true,
      opacity: 0.94,
      emissive: new THREE.Color(GLASS),
      emissiveIntensity: 0.25,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: LIME,
      emissive: new THREE.Color(LIME),
      emissiveIntensity: 0.45,
      metalness: 0.25,
      roughness: 0.3,
    });
    const frame = new THREE.MeshStandardMaterial({
      color: FRAME,
      metalness: 0.5,
      roughness: 0.4,
    });
    return { body, trim, frame };
  }, []);

  useEffect(
    () => () => {
      mats.body.dispose();
      mats.trim.dispose();
      mats.frame.dispose();
    },
    [mats],
  );

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // gentle bob
    if (!reduced) g.position.y = Math.sin(t * 0.55 + phase) * 0.035;
    // hover glow
    const target = hoveredRef.current ? 1.7 : 0.45;
    mats.trim.emissiveIntensity += (target - mats.trim.emissiveIntensity) * 0.12;
    const bodyTarget = hoveredRef.current ? 0.55 : 0.25;
    mats.body.emissiveIntensity += (bodyTarget - mats.body.emissiveIntensity) * 0.1;
  });

  const a = (cfg.angle * Math.PI) / 180;
  const x = Math.sin(a) * RADIUS;
  const z = Math.cos(a) * RADIUS;
  // entrance faces the plaza
  const entranceOffset = {
    x: -Math.sin(a) * 0.85,
    z: -Math.cos(a) * 0.85,
  };

  const setHover = (on: boolean, e?: ThreeEvent<PointerEvent>) => {
    if (e) e.stopPropagation();
    hoveredRef.current = on;
    onHoverChange(
      on && groupRef.current
        ? { name: cfg.name, target: groupRef.current }
        : null,
    );
  };

  const { w, h, d } = cfg;

  return (
    <group
      ref={(g) => {
        groupRef.current = g;
        storeRef?.(g);
      }}
      position={[x, 0, z]}
      rotation={[0, a, 0]}
      onPointerOver={(e) => setHover(true, e)}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e) => setHover(true, e)}
    >
      {/* base slab */}
      <mesh position={[0, 0.09, 0]} material={mats.frame}>
        <boxGeometry args={[w + 0.22, 0.18, d + 0.22]} />
      </mesh>

      {cfg.shape === "tower" && (
        <>
          {/* main tower */}
          <mesh position={[0, 0.22 + h / 2, 0]} material={mats.body}>
            <boxGeometry args={[w * 0.72, h, d * 0.72]} />
          </mesh>
          {/* vertical glass strips */}
          <mesh position={[0, 0.22 + h / 2, 0]} material={mats.frame}>
            <boxGeometry args={[w * 0.78, h - 0.5, d * 0.14]} />
          </mesh>
          {/* lime band */}
          <mesh position={[0, 0.24 + h * 0.45, 0]} material={mats.trim}>
            <boxGeometry args={[w * 0.76, 0.06, d * 0.76]} />
          </mesh>
          {/* roof cap + mast */}
          <mesh position={[0, 0.22 + h + 0.1, 0]} material={mats.frame}>
            <boxGeometry args={[w * 0.5, 0.16, d * 0.5]} />
          </mesh>
          <mesh position={[0, 0.22 + h + 0.42, 0]} material={mats.frame}>
            <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
          </mesh>
          <mesh position={[0, 0.22 + h + 0.72, 0]} material={mats.trim}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
        </>
      )}

      {cfg.shape === "stepped" && (
        <>
          {/* wide lower slab */}
          <mesh position={[0, 0.24 + h * 0.4, 0]} material={mats.body}>
            <boxGeometry args={[w * 0.9, h * 0.8, d * 0.8]} />
          </mesh>
          {/* upper slab */}
          <mesh position={[w * 0.18, 0.24 + h * 0.8, 0]} material={mats.frame}>
            <boxGeometry args={[w * 0.55, h * 0.42, d * 0.55]} />
          </mesh>
          {/* glass front */}
          <mesh position={[0, 0.24 + h * 0.38, d * 0.36]} material={mats.frame}>
            <boxGeometry args={[w * 0.84, h * 0.6, 0.08]} />
          </mesh>
          <mesh position={[0, 0.24 + h * 0.55, 0]} material={mats.trim}>
            <boxGeometry args={[w * 0.92, 0.05, d * 0.86]} />
          </mesh>
        </>
      )}

      {cfg.shape === "block" && (
        <>
          {/* main block */}
          <mesh position={[0, 0.22 + h / 2, 0]} material={mats.body}>
            <boxGeometry args={[w * 0.8, h, d * 0.8]} />
          </mesh>
          {/* side tower */}
          <mesh position={[w * 0.42, 0.24 + h * 0.6, -d * 0.18]} material={mats.frame}>
            <cylinderGeometry args={[0.22, 0.24, h * 1.2, 8]} />
          </mesh>
          {/* mentor ring */}
          <mesh
            position={[0, 0.26 + h, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.trim}
          >
            <torusGeometry args={[w * 0.42, 0.035, 8, 32]} />
          </mesh>
        </>
      )}

      {cfg.shape === "prism" && (
        <>
          {/* body */}
          <mesh position={[0, 0.22 + h * 0.45, 0]} material={mats.body}>
            <boxGeometry args={[w * 0.8, h * 0.9, d * 0.8]} />
          </mesh>
          {/* pyramid roof */}
          <mesh
            position={[0, 0.22 + h + 0.38, 0]}
            rotation={[0, Math.PI / 4, 0]}
            material={mats.frame}
          >
            <coneGeometry args={[w * 0.58, 0.75, 4]} />
          </mesh>
          <mesh position={[0, 0.24 + h * 0.5, 0]} material={mats.trim}>
            <boxGeometry args={[w * 0.84, 0.05, d * 0.84]} />
          </mesh>
        </>
      )}

      {cfg.shape === "dome" && (
        <>
          {/* drum */}
          <mesh position={[0, 0.24 + h * 0.45, 0]} material={mats.body}>
            <cylinderGeometry args={[w * 0.46, w * 0.46, h, 24]} />
          </mesh>
          {/* dome */}
          <mesh
            position={[0, 0.24 + h + w * 0.42, 0]}
            material={mats.frame}
          >
            <sphereGeometry args={[w * 0.46, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {/* entry band */}
          <mesh position={[0, 0.24 + h * 0.35, 0]} material={mats.trim}>
            <cylinderGeometry args={[w * 0.47, w * 0.47, 0.05, 24]} />
          </mesh>
        </>
      )}

      {/* entrance glow (faces the plaza) */}
      <mesh
        position={[entranceOffset.x, 0.34, entranceOffset.z]}
        material={mats.trim}
      >
        <sphereGeometry args={[0.075, 10, 8]} />
      </mesh>

      {/* invisible tap pad — a generous, forgiving target around the space
          so thumbs can hit it easily on small screens (events bubble to the
          group handlers above) */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.5, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

/** Pulsing activity light (scale pulse — no per-frame material writes). */
function ActivityLight({
  position,
  phase,
  reduced,
}: {
  position: [number, number, number];
  phase: number;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const m = ref.current;
    if (!m || reduced) return;
    const s = 0.85 + Math.sin(state.clock.elapsedTime * 2.1 + phase) * 0.28;
    m.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshStandardMaterial
        color={LIME}
        emissive={new THREE.Color(LIME)}
        emissiveIntensity={2}
      />
    </mesh>
  );
}

function Tree({ angle, scale }: { angle: number; scale: number }) {
  const a = (angle * Math.PI) / 180;
  const r = 6.7;
  const x = Math.sin(a) * r;
  const z = Math.cos(a) * r;
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.36, 6]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <coneGeometry args={[0.34, 0.55, 8]} />
        <meshStandardMaterial
          color="#16240e"
          emissive={new THREE.Color("#223b10")}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <coneGeometry args={[0.24, 0.42, 8]} />
        <meshStandardMaterial
          color="#18290f"
          emissive={new THREE.Color("#223b10")}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Camera rig: gentle drift + restrained mouse parallax                */
/* ------------------------------------------------------------------ */

function CameraRig({ mobile, reduced }: { mobile: boolean; reduced: boolean }) {
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const k = Math.min(1, dt * 2.4);
    const px = mobile ? 0 : state.pointer.x;
    const py = mobile ? 0 : state.pointer.y;
    const idleX = reduced ? 0 : Math.sin(t * 0.16) * 0.5;
    const idleY = reduced ? 0 : Math.cos(t * 0.12) * 0.22;
    const tx = px * 1.4 + idleX;
    const ty = (mobile ? 7.6 : 8.1) + py * 0.5 + idleY;
    // Pull back further on narrow screens so the whole campus fits.
    const aspect = size.width / Math.max(1, size.height);
    const tz = mobile ? Math.max(12.4, 12.4 + (1.9 - aspect) * 1.1) : 11.8;
    target.set(tx, ty, tz);
    camera.position.lerp(target, k);
    camera.lookAt(0, 1.1, 0);
  });
  return null;
}

/**
 * Projects every space's world position onto its DOM name label.
 * Writes straight to the DOM (no React re-renders per frame).
 */
function LabelProjector({
  buildingRefs,
  labelRefs,
  hoverIdxRef,
}: {
  buildingRefs: RefObject<(THREE.Object3D | null)[]>;
  labelRefs: RefObject<(HTMLDivElement | null)[]>;
  hoverIdxRef: RefObject<number>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    for (let i = 0; i < BUILDINGS.length; i++) {
      const el = labelRefs.current?.[i];
      const g = buildingRefs.current?.[i];
      if (!el || !g) continue;
      g.getWorldPosition(v);
      v.y += BUILDINGS[i].h + 1.15;
      v.project(camera);
      if (v.z > 1) {
        el.style.opacity = "0";
        continue;
      }
      const active = hoverIdxRef.current === i;
      el.style.opacity = active ? "1" : "0.8";
      const scale = active ? 1.07 : 1;
      // Clamp so pills never spill off the canvas on narrow screens.
      const lx = Math.min(
        Math.max((v.x * 0.5 + 0.5) * size.width, 60),
        Math.max(60, size.width - 60),
      );
      const ly = Math.min(
        Math.max((-v.y * 0.5 + 0.5) * size.height, 34),
        Math.max(34, size.height - 18),
      );
      el.style.transform = `translate3d(${lx}px, ${ly}px, 0) translate(-50%, -110%) scale(${scale})`;
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Campus scene                                                        */
/* ------------------------------------------------------------------ */

function Campus({
  mobile,
  reduced,
  buildingRefs,
  labelRefs,
  hoverIdxRef,
  onHoverName,
}: {
  mobile: boolean;
  reduced: boolean;
  buildingRefs: RefObject<(THREE.Object3D | null)[]>;
  labelRefs: RefObject<(HTMLDivElement | null)[]>;
  hoverIdxRef: RefObject<number>;
  onHoverName: (name: string | null) => void;
}) {
  const campusRef = useRef<THREE.Group>(null);

  const pathMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PATH,
        emissive: new THREE.Color(LIME),
        emissiveIntensity: 0.05,
      }),
    [],
  );
  const plazaMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#12160f",
        metalness: 0.45,
        roughness: 0.45,
      }),
    [],
  );

  useEffect(
    () => () => {
      pathMat.dispose();
      plazaMat.dispose();
    },
    [pathMat, plazaMat],
  );

  const { size } = useThree();

  // The whole campus turns slowly on its axis — clearly visible motion.
  // (Slightly slower on touch so spaces are easier to tap.)
  useFrame((state) => {
    const g = campusRef.current;
    if (!g || reduced) return;
    g.rotation.y = state.clock.elapsedTime * (mobile ? 0.07 : 0.1);
  });

  // Fit the campus to the viewport: on narrow (portrait) screens the ring of
  // spaces would clip at the edges, so scale it down proportionally.
  const aspect = size.width / Math.max(1, size.height);
  const campusScale = Math.min(1, Math.max(0.62, aspect / 1.95));
  useEffect(() => {
    if (campusRef.current) campusRef.current.scale.setScalar(campusScale);
  }, [campusScale]);

  const handleHover = (i: number, info: { name: string; target: THREE.Object3D } | null) => {
    hoverIdxRef.current = info ? i : -1;
    onHoverName(info?.name ?? null);
  };

  return (
    <>
      <group ref={campusRef}>
        {/* central plaza */}
        <mesh position={[0, -0.06, 0]} material={plazaMat}>
          <cylinderGeometry args={[PLAZA_R, PLAZA_R, 0.12, 48]} />
        </mesh>
        {/* plaza rim */}
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[PLAZA_R, 0.035, 8, 64]} />
          <meshStandardMaterial
            color={LIME}
            emissive={new THREE.Color(LIME)}
            emissiveIntensity={0.6}
          />
        </mesh>
        {/* centre obelisk */}
        <mesh position={[0, 0.12, 0]} material={plazaMat}>
          <cylinderGeometry args={[0.16, 0.2, 0.2, 12]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={plazaMat}>
          <boxGeometry args={[0.2, 1.45, 0.2]} />
        </mesh>
        <mesh position={[0, 1.72, 0]}>
          <boxGeometry args={[0.16, 0.18, 0.16]} />
          <meshStandardMaterial
            color={LIME}
            emissive={new THREE.Color(LIME)}
            emissiveIntensity={1.4}
          />
        </mesh>

        {/* paths from plaza to every space */}
        {BUILDINGS.map((b) => {
          const a = (b.angle * Math.PI) / 180;
          const mid = (PLAZA_R + RADIUS - 0.45) / 2;
          return (
            <mesh
              key={`path-${b.id}`}
              position={[Math.sin(a) * mid, 0.012, Math.cos(a) * mid]}
              rotation={[0, a, 0]}
              material={pathMat}
            >
              <boxGeometry args={[RADIUS - PLAZA_R - 0.45, 0.025, 0.4]} />
            </mesh>
          );
        })}

        {/* the six spaces */}
        {BUILDINGS.map((b, i) => (
          <Building
            key={b.id}
            cfg={b}
            phase={i * 1.05}
            reduced={reduced}
            onHoverChange={(info) => handleHover(i, info)}
            storeRef={(g) => {
              if (buildingRefs.current) buildingRefs.current[i] = g;
            }}
          />
        ))}

        {/* activity lights at each entrance */}
        {BUILDINGS.map((b, i) => {
          const a = (b.angle * Math.PI) / 180;
          return (
            <ActivityLight
              key={`light-${b.id}`}
              position={[Math.sin(a) * (RADIUS - 0.75), 0.42, Math.cos(a) * (RADIUS - 0.75)]}
              phase={i * 0.9}
              reduced={reduced}
            />
          );
        })}

        {/* trees between spaces */}
        {TREE_ANGLES.map((angle, i) => (
          <Tree key={`tree-${i}`} angle={angle} scale={i % 2 === 0 ? 1 : 0.8} />
        ))}
      </group>

      {/* invisible tap-away / hover-away zone: clears the label when the
          pointer touches empty space (keeps mobile feel clean) */}
      <mesh
        position={[0, -0.3, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          handleHover(-1, null);
        }}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <CameraRig mobile={mobile} reduced={reduced} />
      <LabelProjector
        buildingRefs={buildingRefs}
        labelRefs={labelRefs}
        hoverIdxRef={hoverIdxRef}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Static SVG fallback (no WebGL) — still animated, names included     */
/* ------------------------------------------------------------------ */

function StaticFallback() {
  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      role="img"
      aria-label="ForgeX Learning Community — six spaces around a central plaza"
    >
      <defs>
        <radialGradient id="fx-plaza-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={LIME} stopOpacity="0.16" />
          <stop offset="100%" stopColor={LIME} stopOpacity="0" />
        </radialGradient>
        <style>{`
          @keyframes fx-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          @keyframes fx-pulse { 0%,100% { opacity: 0.45; } 50% { opacity: 0.95; } }
          .fx-float { animation: fx-float 5.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .fx-pulse { animation: fx-pulse 3.2s ease-in-out infinite; }
        `}</style>
      </defs>
      <rect width="400" height="240" fill="#0b0d09" />
      <circle cx="200" cy="120" r="95" fill="url(#fx-plaza-glow)" className="fx-pulse" />
      {/* plaza */}
      <circle
        cx="200"
        cy="120"
        r="34"
        fill="none"
        stroke={LIME}
        strokeOpacity="0.5"
        strokeWidth="1.5"
        className="fx-pulse"
      />
      <rect x="197" y="96" width="6" height="14" fill={LIME} fillOpacity="0.9" />
      {/* paths */}
      {BUILDINGS.map((b) => {
        const a = (b.angle * Math.PI) / 180;
        const x1 = 200 + Math.sin(a) * 40;
        const y1 = 120 + Math.cos(a) * 40;
        const x2 = 200 + Math.sin(a) * 82;
        const y2 = 120 + Math.cos(a) * 82;
        return (
          <line
            key={`p-${b.id}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={LIME}
            strokeOpacity="0.18"
            strokeWidth="2"
          />
        );
      })}
      {/* spaces + names */}
      {BUILDINGS.map((b, i) => {
        const a = (b.angle * Math.PI) / 180;
        const x = 200 + Math.sin(a) * 92;
        const y = 120 + Math.cos(a) * 92;
        const w = 26 - (i % 3) * 3;
        return (
          <g key={b.id} className="fx-float" style={{ animationDelay: `${i * 0.55}s` }}>
            <rect
              x={x - w / 2}
              y={y - w / 2}
              width={w}
              height={w}
              rx="3"
              fill="#13170f"
              stroke={LIME}
              strokeOpacity="0.45"
              strokeWidth="1.2"
            />
            <circle cx={x} cy={y} r="2.2" fill={LIME} fillOpacity="0.9" />
            <text
              x={x}
              y={y + w / 2 + 13}
              textAnchor="middle"
              fill={LIME}
              fillOpacity="0.85"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              {b.name}
            </text>
          </g>
        );
      })}
      {/* tiny trees */}
      {TREE_ANGLES.map((a2, i) => {
        const a = (a2 * Math.PI) / 180;
        const x = 200 + Math.sin(a) * 108;
        const y = 120 + Math.cos(a) * 108;
        return (
          <circle
            key={`t-${i}`}
            cx={x}
            cy={y}
            r="3"
            fill="#1c2c10"
            stroke={LIME}
            strokeOpacity="0.35"
            strokeWidth="0.8"
            className="fx-float"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        );
      })}
    </svg>
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
/* Public component                                                    */
/* ------------------------------------------------------------------ */

export function ForgeXLearningCommunity() {
  const containerRef = useRef<HTMLDivElement>(null);
  const buildingRefs = useRef<(THREE.Object3D | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hoverIdxRef = useRef(-1);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [hoverName, setHoverName] = useState<string | null>(null);

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
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (webgl === false) {
    return (
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
        <div className="relative h-72 sm:h-[26rem]">
          <StaticFallback />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mx-auto mt-10 w-full max-w-4xl sm:mt-14">
      {/* eyebrow — small, outside the 3D scene */}
      <div className="mb-3 flex items-center justify-center gap-2.5">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-lime-400/60" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-lime-300/90">
          ForgeX Learning Community
        </p>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-lime-400/60" />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30">
        {/* soft lime ambience behind the glass */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 42%, rgba(163,230,53,0.07), transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03), transparent 30%, transparent 70%, rgba(0,0,0,0.35))",
          }}
        />

        <div className="relative h-72 w-full select-none sm:h-[26rem]">
          {webgl === null ? (
            <div className="flex h-full items-center justify-center">
              <div className="size-8 animate-pulse rounded-full border-2 border-lime-400/30 border-t-lime-400" />
            </div>
          ) : (
            <SceneErrorBoundary fallback={<StaticFallback />}>
              <Canvas
                dpr={mobile ? [1, 1.5] : [1, 2]}
                frameloop={visible ? "always" : "never"}
                camera={{ position: [0, 8.1, 11.8], fov: mobile ? 44 : 40 }}
                gl={{ antialias: true, alpha: true }}
                style={{ touchAction: "pan-y" }}
              >
                <ambientLight intensity={0.55} color="#e8f7d4" />
                <pointLight position={[0, 6, 2]} intensity={1.1} distance={26} color={LIME} />
                <pointLight position={[0, 5, -6]} intensity={0.55} distance={22} color="#d9f99d" />
                <Campus
                  mobile={mobile}
                  reduced={reduced}
                  buildingRefs={buildingRefs}
                  labelRefs={labelRefs}
                  hoverIdxRef={hoverIdxRef}
                  onHoverName={setHoverName}
                />
              </Canvas>
            </SceneErrorBoundary>
          )}

          {/* name labels — DOM overlays (outside the Canvas), projected each
              frame onto their buildings, always visible */}
          {BUILDINGS.map((b, i) => (
            <div
              key={b.id}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              className={
                "pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap rounded-full border bg-[#0d0f0c]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur transition-colors duration-150 " +
                (hoverName === b.name
                  ? "border-lime-400/70 text-lime-200"
                  : "border-lime-400/25 text-lime-300/80")
              }
              style={{
                opacity: 0,
                transform: "translate(-50%, -110%)",
                willChange: "transform, opacity",
              }}
            >
              <span className="mr-1.5 inline-block size-1 rounded-full bg-lime-400 align-middle" />
              {b.name}
            </div>
          ))}
        </div>

        {/* hints — mobile says tap, desktop says hover */}
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60 sm:hidden">
          Tap a space to explore
        </p>
        <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60 sm:block">
          Hover a space to explore
        </p>
      </div>
    </div>
  );
}
