/**
 * FORGEX ORB CORE — the interactive 3D centerpiece of the homepage.
 *
 * A premium matte-black sphere with electric-lime meridians, hovering in
 * space. It starts CLOSED, slowly floating and rotating. When the visitor
 * scrolls (or hovers / taps it) the orb splits open like a seed pod: six
 * solid shell petals bloom outward on the rim while the lower bowl stays
 * fixed, revealing a glowing quantum core with floating holographic icons.
 *
 * Then the transformation: real 3D objects physically EMERGE from inside the
 * orb — laptop, phone, camera, headphones, tablet, keyboard, a 3D book, an
 * AI holographic panel and floating course cards. Each starts small at the
 * core, then rises, unfolds and floats outward along its own trajectory.
 * Once out, the objects stay suspended around the orb, gently orbiting and
 * floating with natural depth. The orb remains the central "source".
 *
 * The three act narrative maps onto the hero headline:
 *   DISCOVER → the orb floats closed and rotating
 *   EXPRESS  → the petals bloom open, the quantum core glows
 *   BUILD    → objects emerge and the ForgeX ecosystem forms around it
 *
 * Built from Three.js primitives + hand-built shell geometry (no external
 * models, no drei). Performance-minded:
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
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { motion } from "framer-motion";
import { renderToStaticMarkup } from "react-dom/server";
import { Bot, GraduationCap, Palette, Users } from "lucide-react";

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
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

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

/**
 * Rasterizes a lucide icon (React element) into a crisp canvas texture
 * synchronously: the rendered SVG markup is parsed, then every stroke path
 * is redrawn with Path2D so the icon reads as a sharp, premium "picture"
 * inside the orb. Falls back to an empty texture rather than throwing.
 */
function iconCanvasTexture(icon: ReactNode, color: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const tex = new THREE.CanvasTexture(canvas);
  try {
    const ctx = canvas.getContext("2d");
    const markup = renderToStaticMarkup(icon);
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    if (!ctx || doc.querySelector("parsererror")) return tex;
    const pad = 40;
    const s = (size - pad * 2) / 24;
    ctx.save();
    ctx.translate(pad, pad);
    ctx.scale(s, s);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const stroke = (p: Path2D, fill?: string | null) => {
      if (fill && fill !== "none") ctx.fill(p);
      ctx.stroke(p);
    };
    doc.querySelectorAll("path, circle, rect, line, polyline, polygon, ellipse").forEach((el) => {
      const fill = el.getAttribute("fill");
      switch (el.tagName) {
        case "path": {
          const d = el.getAttribute("d");
          if (d) stroke(new Path2D(d), fill);
          break;
        }
        case "circle": {
          const p = new Path2D();
          p.arc(
            parseFloat(el.getAttribute("cx") || "0"),
            parseFloat(el.getAttribute("cy") || "0"),
            parseFloat(el.getAttribute("r") || "0"),
            0,
            Math.PI * 2,
          );
          stroke(p, fill);
          break;
        }
        case "rect": {
          const p = new Path2D();
          p.rect(
            parseFloat(el.getAttribute("x") || "0"),
            parseFloat(el.getAttribute("y") || "0"),
            parseFloat(el.getAttribute("width") || "0"),
            parseFloat(el.getAttribute("height") || "0"),
          );
          stroke(p, fill);
          break;
        }
        case "line": {
          const p = new Path2D();
          p.moveTo(
            parseFloat(el.getAttribute("x1") || "0"),
            parseFloat(el.getAttribute("y1") || "0"),
          );
          p.lineTo(
            parseFloat(el.getAttribute("x2") || "0"),
            parseFloat(el.getAttribute("y2") || "0"),
          );
          stroke(p, fill);
          break;
        }
        case "polyline":
        case "polygon": {
          const pts = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
          if (pts.length >= 4) {
            const p = new Path2D();
            p.moveTo(pts[0], pts[1]);
            for (let i = 2; i + 1 < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
            if (el.tagName === "polygon") p.closePath();
            stroke(p, fill);
          }
          break;
        }
        case "ellipse": {
          const p = new Path2D();
          p.ellipse(
            parseFloat(el.getAttribute("cx") || "0"),
            parseFloat(el.getAttribute("cy") || "0"),
            parseFloat(el.getAttribute("rx") || "0"),
            parseFloat(el.getAttribute("ry") || "0"),
            0,
            0,
            Math.PI * 2,
          );
          stroke(p, fill);
          break;
        }
      }
    });
    ctx.restore();
    tex.needsUpdate = true;
  } catch {
    // never let icon rasterization take down the scene
  }
  return tex;
}

/** Inner SVG markup of a lucide icon, for reuse inside the fallback SVG. */
function iconInnerSvg(icon: ReactNode): string {
  const markup = renderToStaticMarkup(icon);
  const m = markup.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return m ? m[1] : "";
}

/* ------------------------------------------------------------------ */
/* Orb Core geometry — a sphere that splits open like a seed pod       */
/* ------------------------------------------------------------------ */

const ORB_R = 1.15; // orb radius
const ORB_T = 0.09; // petal shell thickness
const ORB_PETALS = 6; // blooming petals
const ORB_PHI0 = 0.16; // bowl rim latitude (radians, just above the equator)
const ORB_PHI_MAX = Math.PI / 2 - 0.05; // petal tip latitude
const PETAL_BLOOM = 2.35; // radians — petal swing at full open

/** Point on a sphere (th = azimuth around Y, ph = latitude, Y up). */
function sphPoint(
  r: number,
  th: number,
  ph: number,
): [number, number, number] {
  return [
    r * Math.cos(ph) * Math.sin(th),
    r * Math.sin(ph),
    r * Math.cos(ph) * Math.cos(th),
  ];
}

/** Unit radial direction for a point on the unit sphere. */
function sphUnit(th: number, ph: number): [number, number, number] {
  return [Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)];
}

const sub3 = (
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Builds all the orb geometry:
 *
 *  - `bowlGeo`  — the lower machine body: a matte spherical cap from the
 *    south pole up to the rim latitude (φ0). Stays fixed.
 *  - `petalGeo` — ONE solid petal (outer + inner shell, meridian walls,
 *    bottom cap and pole cap) in its own local frame with its pivot at the
 *    origin. All six petals share it; each petal group positions the pivot
 *    on the rim circle and blooms it open by rotating about the local X
 *    axis (the azimuthal tangent) at that point.
 *  - `petalEdgeGeo` — the glowing lime meridian lines along both side
 *    edges of the petal, so the closed orb reads as a black sphere with
 *    electric-lime meridians.
 *
 * Every triangle carries exact outward-pointing normals (analytic per
 * surface), so the shell renders smooth and glossy under any lighting.
 */
function buildOrbGeometries(
  r: number,
  t: number,
  petals: number,
  phi0: number,
  phiMax: number,
) {
  const h = Math.PI / petals - 0.024; // half angular width per petal (tiny gap → meridian glow)
  const nT = 7;
  const nP = 9;
  const piv = sphPoint(r, 0, phi0); // petal pivot (bottom-center on the rim)

  const pos: number[] = [];
  const nor: number[] = [];
  const push = (p: [number, number, number], n: [number, number, number]) => {
    pos.push(p[0], p[1], p[2]);
    nor.push(n[0], n[1], n[2]);
  };
  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    an: [number, number, number],
    bn: [number, number, number],
    cn: [number, number, number],
  ) => {
    push(a, an);
    push(b, bn);
    push(c, cn);
  };

  // ---- petal surface grids (relative to the pivot) ----
  const outerPts: [number, number, number][][] = [];
  const innerPts: [number, number, number][][] = [];
  const thAt = (i: number) => -h + (i / nT) * 2 * h;
  const phAt = (j: number) => phi0 + (j / nP) * (phiMax - phi0);
  for (let j = 0; j <= nP; j++) {
    const ph = phAt(j);
    const oRow: [number, number, number][] = [];
    const iRow: [number, number, number][] = [];
    for (let i = 0; i <= nT; i++) {
      const th = thAt(i);
      oRow.push(sub3(sphPoint(r, th, ph), piv));
      iRow.push(sub3(sphPoint(r - t, th, ph), piv));
    }
    outerPts.push(oRow);
    innerPts.push(iRow);
  }
  const poleO = sub3([0, r, 0], piv);
  const poleI = sub3([0, r - t, 0], piv);

  // ---- outer shell (normals point radially outward) ----
  for (let j = 0; j < nP; j++) {
    for (let i = 0; i < nT; i++) {
      const a = outerPts[j][i];
      const b = outerPts[j][i + 1];
      const c = outerPts[j + 1][i + 1];
      const d = outerPts[j + 1][i];
      const na = sphUnit(thAt(i), phAt(j));
      const nb = sphUnit(thAt(i + 1), phAt(j));
      const nc = sphUnit(thAt(i + 1), phAt(j + 1));
      const nd = sphUnit(thAt(i), phAt(j + 1));
      pushTri(a, b, c, na, nb, nc);
      pushTri(a, c, d, na, nc, nd);
    }
  }

  // ---- inner shell (normals point radially inward, toward the orb center) ----
  for (let j = 0; j < nP; j++) {
    for (let i = 0; i < nT; i++) {
      const a = innerPts[j][i];
      const b = innerPts[j][i + 1];
      const c = innerPts[j + 1][i + 1];
      const d = innerPts[j + 1][i];
      const na = sphUnit(thAt(i), phAt(j)).map((v) => -v) as [number, number, number];
      const nb = sphUnit(thAt(i + 1), phAt(j)).map((v) => -v) as [number, number, number];
      const nc = sphUnit(thAt(i + 1), phAt(j + 1)).map((v) => -v) as [number, number, number];
      const nd = sphUnit(thAt(i), phAt(j + 1)).map((v) => -v) as [number, number, number];
      pushTri(a, c, b, na, nc, nb);
      pushTri(a, d, c, na, nd, nc);
    }
  }

  // ---- meridian side walls (normals point away from the petal center) ----
  const wallN = (sign: 1 | -1) =>
    sign === 1
      ? ([Math.cos(h), 0, -Math.sin(h)] as [number, number, number])
      : ([-Math.cos(h), 0, -Math.sin(h)] as [number, number, number]);
  for (const sign of [1, -1] as const) {
    const i = sign === 1 ? nT : 0;
    const n = wallN(sign);
    for (let j = 0; j < nP; j++) {
      const oa = outerPts[j][i];
      const ob = outerPts[j + 1][i];
      const ib = innerPts[j + 1][i];
      const ia = innerPts[j][i];
      pushTri(oa, ob, ib, n, n, n);
      pushTri(oa, ib, ia, n, n, n);
    }
  }

  // ---- bottom cap (normals point down, away from the solid) ----
  for (let i = 0; i < nT; i++) {
    const th = thAt(i + 0.5);
    const n = [-Math.sin(phi0) * Math.sin(th), -Math.cos(phi0), -Math.sin(phi0) * Math.cos(th)] as [
      number,
      number,
      number,
    ];
    const oa = outerPts[0][i];
    const ob = outerPts[0][i + 1];
    const ib = innerPts[0][i + 1];
    const ia = innerPts[0][i];
    pushTri(oa, ob, ib, n, n, n);
    pushTri(oa, ib, ia, n, n, n);
  }

  // ---- pole caps (fan from the top ring to the tip) ----
  const up = [0, 1, 0] as [number, number, number];
  const dn = [0, -1, 0] as [number, number, number];
  for (let i = 0; i < nT; i++) {
    const a = outerPts[nP][i];
    const b = outerPts[nP][i + 1];
    pushTri(a, b, poleO, up, up, up);
    const ia = innerPts[nP][i];
    const ib = innerPts[nP][i + 1];
    pushTri(ib, ia, poleI, dn, dn, dn);
  }

  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  petalGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));

  // ---- glowing lime meridians along both petal edges ----
  const linePts: number[] = [];
  const span = phiMax - phi0 + 0.1;
  for (const s of [-1, 1] as const) {
    for (let k = 0; k < 10; k++) {
      const ph1 = phi0 + 0.02 + (k / 10) * span;
      const ph2 = phi0 + 0.02 + ((k + 1) / 10) * span;
      const p1 = sub3(sphPoint(r + 0.02, s * h, ph1), piv);
      const p2 = sub3(sphPoint(r + 0.02, s * h, ph2), piv);
      linePts.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    }
  }
  const petalEdgeGeo = new THREE.BufferGeometry();
  petalEdgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));

  // ---- lower bowl: spherical cap from the south pole to the rim ----
  const nTB = 14;
  const nPB = 7;
  const bPos: number[] = [];
  const bNor: number[] = [];
  const bIdx: number[] = [];
  for (let j = 0; j <= nPB; j++) {
    const ph = -Math.PI / 2 + (j / nPB) * (phi0 + Math.PI / 2);
    for (let i = 0; i <= nTB; i++) {
      const th = (i / nTB) * Math.PI * 2;
      bPos.push(...sphPoint(r, th, ph));
      bNor.push(...sphUnit(th, ph));
    }
  }
  const bi = (j: number, i: number) => j * (nTB + 1) + i;
  for (let j = 0; j < nPB; j++) {
    for (let i = 0; i < nTB; i++) {
      const a = bi(j, i);
      const b = bi(j, i + 1);
      const c = bi(j + 1, i + 1);
      const d = bi(j + 1, i);
      bIdx.push(a, b, c, a, c, d);
    }
  }
  const bowlGeo = new THREE.BufferGeometry();
  bowlGeo.setAttribute("position", new THREE.Float32BufferAttribute(bPos, 3));
  bowlGeo.setAttribute("normal", new THREE.Float32BufferAttribute(bNor, 3));
  bowlGeo.setIndex(bIdx);

  return { bowlGeo, petalGeo, petalEdgeGeo };
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
  /** Inside the orb (origin point of emergence). */
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
    from: [0, 0.15, 0],
    mid: [0, 1.3, -0.4],
    to: [-0.95, 0.95, -1.7],
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
    from: [-0.15, 0.15, 0.05],
    mid: [-0.6, 1.5, -0.2],
    to: [-2.0, 1.3, -0.55],
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
    from: [0.15, 0.15, 0.02],
    mid: [0.7, 1.2, 0],
    to: [2.0, 0.7, 0.35],
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
    from: [0.05, 0.18, 0],
    mid: [0.1, 1.8, 0.1],
    to: [0.5, 2.0, -1.15],
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
    from: [0, 0.2, -0.05],
    mid: [0, 2.1, 0.3],
    to: [0, 2.4, 0.85],
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
    from: [-0.1, 0.15, 0.05],
    mid: [-0.5, 1.15, 0.15],
    to: [-1.55, 1.85, 1.15],
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
    from: [0.1, 0.15, 0.03],
    mid: [0.6, 1.05, 0.35],
    to: [1.5, 1.5, 1.3],
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
    from: [0.05, 0.12, 0.08],
    mid: [0.3, 0.9, 0.7],
    to: [0.7, 0.15, 1.95],
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
    from: [0.02, 0.18, -0.04],
    mid: [0.1, 1.1, -0.3],
    to: [-2.2, 0.55, -1.25],
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

/**
 * Holographic icon pictures floating above the quantum core inside the orb.
 * These are real lucide glyphs (rasterized to crisp canvas textures) on
 * soft glow discs — representing the ForgeX ecosystem: courses, AI,
 * creativity and community. "Both (objects + icons)": the icons live in
 * the interior while the 3D objects emerge outward from the core.
 */
const ICONS = [
  { id: "courses", icon: <GraduationCap />, x: -0.46, y: 0.62, z: 0.04, phase: 0, s: 0.52 },
  { id: "ai", icon: <Bot />, x: 0, y: 0.86, z: -0.42, phase: 1.2, s: 0.58 },
  { id: "create", icon: <Palette />, x: 0.46, y: 0.62, z: 0.04, phase: 2.4, s: 0.52 },
  { id: "community", icon: <Users />, x: 0, y: 0.62, z: 0.48, phase: 3.6, s: 0.55 },
];

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

type Mats = {
  body: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  metal: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  screenDark: THREE.MeshStandardMaterial;
  panelMat: THREE.MeshBasicMaterial;
  crystal: THREE.MeshPhysicalMaterial;
  bowl: THREE.MeshPhysicalMaterial;
  edge: THREE.LineBasicMaterial;
  coreMat: THREE.MeshBasicMaterial;
  beam: THREE.MeshBasicMaterial;
  ringA: THREE.MeshBasicMaterial;
  ringB: THREE.MeshBasicMaterial;
  shell: THREE.MeshBasicMaterial;
  field: THREE.MeshBasicMaterial;
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
    // polished details
    metal: new THREE.MeshPhysicalMaterial({
      color: "#262b33",
      metalness: 0.95,
      roughness: 0.18,
      clearcoat: 0.5,
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
    // dark glass for device screens
    screenDark: new THREE.MeshStandardMaterial({
      color: "#04060a",
      metalness: 0.55,
      roughness: 0.3,
    }),
    // holographic panels / icons
    panelMat: new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    // smooth orb petals — matte black with a glossy clearcoat
    crystal: new THREE.MeshPhysicalMaterial({
      color: "#0f1318",
      metalness: 0.8,
      roughness: 0.22,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#0c1014"),
      emissiveIntensity: 0.55,
    }),
    // lower bowl — the machine body (glossy matte black)
    bowl: new THREE.MeshPhysicalMaterial({
      color: "#12161c",
      metalness: 0.7,
      roughness: 0.3,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
      side: THREE.DoubleSide,
    }),
    // neon-lime meridian edges
    edge: new THREE.LineBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.5,
    }),
    // quantum core orb
    coreMat: new THREE.MeshBasicMaterial({ color: LIME_SOFT }),
    // additive light beam
    beam: new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
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
    // quantum containment shell (dissolves as the orb opens)
    shell: new THREE.MeshBasicMaterial({
      color: LIME,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    // quantum field around the core
    field: new THREE.MeshBasicMaterial({
      color: LIME,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
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
    camera.position.y += (1.05 + py * 0.3 - camera.position.y) * k;
    camera.lookAt(0, 0.55, 0);
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
/* The quantum pod — geometry, spring, ambient motion                  */
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
  const petalRefs = useRef<(THREE.Group | null)[]>([]);
  const coreRef = useRef<THREE.Mesh>(null);
  const fieldRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const interiorLightRef = useRef<THREE.PointLight>(null);
  const iconRefs = useRef<(THREE.Group | null)[]>([]);
  const particlesRef = useRef<THREE.Points>(null);
  const ringsRef = useRef<THREE.Group>(null);
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

  // orb geometry — lower bowl + shared petal solid + meridian edges
  const orb = useMemo(
    () => buildOrbGeometries(ORB_R, ORB_T, ORB_PETALS, ORB_PHI0, ORB_PHI_MAX),
    [],
  );
  useEffect(
    () => () => {
      orb.bowlGeo.dispose();
      orb.petalGeo.dispose();
      orb.petalEdgeGeo.dispose();
    },
    [orb],
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

  // real-icon materials for the holographic interior glyphs
  const iconMats = useMemo(
    () =>
      ICONS.map((d) => ({
        glow: new THREE.SpriteMaterial({
          map: glowTex,
          color: LIME,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        icon: new THREE.SpriteMaterial({
          map: iconCanvasTexture(d.icon, LIME_SOFT),
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        }),
      })),
    [glowTex],
  );
  useEffect(
    () => () => {
      iconMats.forEach((m) => {
        m.glow.dispose();
        m.icon.dispose();
        m.icon.map?.dispose();
      });
    },
    [iconMats],
  );

  // floating particles around the orb
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

  // fit the orb to the viewport: pull back on narrow (portrait) screens
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
    const petalP = smoothstep(open, 0, 0.3); // petals fully bloom first
    const glowP = smoothstep(open, 0.25, 0.7);

    // pod: float + rotate (+ hover parallax on desktop); tilts forward
    // slightly as it opens to present the interior
    const g = deviceRef.current;
    if (g) {
      if (reduced) {
        g.position.y = 0;
        g.rotation.y = 0.42;
        g.rotation.x = open * 0.14;
        g.rotation.z = 0;
      } else {
        g.position.y = Math.sin(t * 0.7) * 0.1 * (1 - open * 0.4);
        const px = mobile ? 0 : state.pointer.x;
        const py = mobile ? 0 : state.pointer.y;
        g.rotation.y = t * 0.2 + px * 0.16;
        g.rotation.x = open * 0.14 + py * 0.06;
        g.rotation.z = Math.sin(t * 0.45) * 0.02;
      }
    }

    // orb petals — bloom outward on the rim like a seed pod opening
    petalRefs.current.forEach((p) => {
      if (p) p.rotation.x = petalP * PETAL_BLOOM + Math.sin(petalP * Math.PI) * 0.03;
    });

    // quantum core pulse + field rotation
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.09 + glowP * 0.4);
    }
    if (fieldRef.current) {
      fieldRef.current.rotation.y = t * 0.5;
      fieldRef.current.rotation.x = t * 0.3;
    }
    if (interiorLightRef.current) {
      interiorLightRef.current.intensity = glowP * 12;
    }

    // holographic icon pictures materialize and pulse over the core
    iconRefs.current.forEach((icon, i) => {
      if (!icon) return;
      const ic = ICONS[i];
      const s = 0.001 + glowP * (1 + Math.sin(t * 1.4 + ic.phase) * 0.08);
      icon.scale.setScalar(s);
      icon.position.y = ic.y + Math.sin(t * 1.1 + ic.phase) * 0.05 * glowP;
    });

    // beam + containment shell
    mats.beam.opacity = 0.05 + glowP * 0.17;
    if (beamRef.current) {
      beamRef.current.scale.setScalar(0.55 + glowP * 0.55 + Math.sin(t * 1.6) * 0.04);
    }
    mats.shell.opacity = 0.1 * (1 - petalP);

    // particles + light rings drift slowly
    if (particlesRef.current && !reduced) {
      particlesRef.current.rotation.y = t * 0.06;
      particlesRef.current.position.y = Math.sin(t * 0.5) * 0.06;
    }
    if (ringsRef.current && !reduced) {
      ringsRef.current.rotation.y = t * 0.24;
      ringsRef.current.rotation.x = 0.16 + Math.sin(t * 0.35) * 0.04;
    }
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
        <mesh position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.4, 3.8]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[0, -1.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.8, 4.2]} />
          <meshBasicMaterial
            map={glowTex}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* ---------------- BOWL (lower orb — the fixed machine body) ---------------- */}
        <mesh geometry={orb.bowlGeo} material={mats.bowl} />

        {/* glowing rim ring at the bowl's lip */}
        <mesh
          position={[0, ORB_R * Math.sin(ORB_PHI0), 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={mats.trim}
        >
          <torusGeometry args={[ORB_R * Math.cos(ORB_PHI0), 0.022, 8, 48]} />
        </mesh>

        {/* south-pole status node */}
        <mesh position={[0, -ORB_R, 0]} material={mats.core}>
          <sphereGeometry args={[0.042, 12, 12]} />
        </mesh>
        <mesh position={[0, -ORB_R, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
          <torusGeometry args={[0.11, 0.012, 8, 20]} />
        </mesh>

        {/* ---------------- ORB PETALS (bloom open like a seed pod) ---------------- */}
        {Array.from({ length: ORB_PETALS }).map((_, i) => {
          const a = (i / ORB_PETALS) * Math.PI * 2;
          return (
            <group
              key={i}
              position={[
                ORB_R * Math.cos(ORB_PHI0) * Math.sin(a),
                ORB_R * Math.sin(ORB_PHI0),
                ORB_R * Math.cos(ORB_PHI0) * Math.cos(a),
              ]}
              rotation={[0, a, 0]}
            >
              <group
                ref={(el) => {
                  petalRefs.current[i] = el;
                }}
              >
                <mesh geometry={orb.petalGeo} material={mats.crystal} />
                <lineSegments geometry={orb.petalEdgeGeo} material={mats.edge} />
              </group>
            </group>
          );
        })}

        {/* ---------------- INTERIOR: glowing core + holographic icons ---------------- */}
        <group position={[0, 0, 0]}>
          {/* quantum core orb */}
          <mesh ref={coreRef} material={mats.coreMat} position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
          </mesh>
          {/* quantum field wireframe */}
          <mesh ref={fieldRef} material={mats.field} position={[0, 0.34, 0]}>
            <icosahedronGeometry args={[0.34, 0]} />
          </mesh>
          {/* holographic icons */}
          {ICONS.map((ic, i) => (
            <group
              key={ic.id}
              ref={(el) => {
                iconRefs.current[i] = el;
              }}
              position={[ic.x, ic.y, ic.z]}
              scale={0.001}
            >
              {ic.id === "book" && (
                <>
                  <mesh material={mats.panelMat} rotation={[0, 0, 0.5]}>
                    <boxGeometry args={[0.17, 0.07, 0.008]} />
                  </mesh>
                  <mesh material={mats.panelMat} rotation={[0, 0, -0.5]}>
                    <boxGeometry args={[0.17, 0.07, 0.008]} />
                  </mesh>
                </>
              )}
              {ic.id === "ai" && (
                <>
                  <mesh material={mats.core}>
                    <octahedronGeometry args={[0.07, 0]} />
                  </mesh>
                  <mesh material={mats.panelMat} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.11, 0.006, 6, 20]} />
                  </mesh>
                </>
              )}
              {ic.id === "spark" && (
                <mesh material={mats.core}>
                  <tetrahedronGeometry args={[0.08, 0]} />
                </mesh>
              )}
              {ic.id === "people" && (
                <>
                  <mesh material={mats.panelMat} position={[-0.05, 0.02, 0]}>
                    <sphereGeometry args={[0.04, 10, 10]} />
                  </mesh>
                  <mesh material={mats.panelMat} position={[0.05, 0.02, 0]}>
                    <sphereGeometry args={[0.04, 10, 10]} />
                  </mesh>
                </>
              )}
            </group>
          ))}
          {/* light beam rising from the core */}
          <mesh ref={beamRef} material={mats.beam} position={[0, 0.95, 0]}>
            <coneGeometry args={[0.5, 1.4, 24, 1, true]} />
          </mesh>
          <pointLight ref={interiorLightRef} position={[0, 0.5, 0]} intensity={0} distance={6} decay={2} color={LIME} />
        </group>

        {/* quantum containment shell — dissolves as the orb opens */}
        <mesh material={mats.shell} position={[0, 0.45, 0]}>
          <icosahedronGeometry args={[1.8, 0]} />
        </mesh>

        {/* ---------------- FLOATING OBJECTS (emerge from the core) ---------------- */}
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
        aria-label="ForgeX Quantum Pod — a faceted matte-black and electric-lime crystal that blooms open and releases laptops, phones, cameras, books and AI panels"
      >
        <defs>
          <radialGradient id="fxd-ambient" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={LIME} stopOpacity="0.14" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fxd-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={LIME} stopOpacity="0.55" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0" />
          </radialGradient>
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

        {/* floating pod */}
        <motion.g
          initial={false}
          animate={reduced ? undefined : { y: [0, -7, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* floor shadow + glow */}
          <ellipse cx="210" cy="268" rx="92" ry="14" fill="#000" opacity="0.55" />
          <ellipse cx="210" cy="266" rx="104" ry="18" fill={LIME} opacity="0.1" />

          {/* containment shell — dissolves as the pod opens */}
          <motion.ellipse
            cx="210"
            cy="150"
            rx="88"
            ry="108"
            fill="none"
            stroke={LIME}
            strokeWidth="1"
            initial={false}
            animate={{ opacity: 0.35 - open * 0.3 }}
            transition={{ duration: 0.6 }}
          />

          {/* pavilion (lower crystal half) */}
          <polygon points="150,150 270,150 210,262" fill="#10141a" stroke="#2a3038" strokeWidth="1.5" />
          <polyline points="150,150 210,262 270,150" fill="none" stroke={LIME} strokeOpacity="0.45" strokeWidth="1.2" />

          {/* girdle seam */}
          <line x1="150" y1="150" x2="270" y2="150" stroke={LIME} strokeWidth="2" opacity="0.85" />

          {/* interior core — revealed when open */}
          <motion.g initial={false} animate={{ opacity: open }} transition={{ duration: 0.6 }}>
            <circle cx="210" cy="152" r="34" fill="url(#fxd-core)" />
            <circle cx="210" cy="152" r="7" fill={LIME} opacity="0.95" />
            <rect x="203" y="100" width="14" height="52" rx="7" fill="url(#fxd-beam)" />
          </motion.g>

          {/* crown — blooms open on the base-right hinge */}
          <motion.g
            initial={false}
            animate={{ rotate: open * 100 }}
            transition={{ duration: 1.3, ease: easing }}
            style={{ originX: 1, originY: 1, transformBox: "fill-box" }}
          >
            <polygon points="150,150 270,150 210,58" fill="#141820" stroke="#333a44" strokeWidth="1.5" />
            <polyline points="150,150 210,58 270,150" fill="none" stroke={LIME} strokeOpacity="0.5" strokeWidth="1.2" />
          </motion.g>
        </motion.g>

        {/* emerging objects — rise from the opened pod and float out */}
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
        ForgeX Quantum Pod
      </p>
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-lime-400/60" />
    </div>
  );
}

function Hint({ mobile }: { mobile: boolean }) {
  return (
    <p className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/50">
      {mobile ? "Scroll or tap to open the pod" : "Scroll or hover to open the pod"}
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

  // scroll-reactive opening: the sequence plays as you scroll past the pod
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
          aria-label="Interactive 3D ForgeX Quantum Pod"
        >
          {/* soft lime ambience behind the pod */}
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
                  camera={{ position: [0, 1.05, 7.3], fov: 38 }}
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
