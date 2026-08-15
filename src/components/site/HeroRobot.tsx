import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * The official ForgeX mascot — a transparent PNG rendered as a real <img>.
 *
 * The image is NEVER redrawn, traced or replaced: the exact uploaded file is
 * shown and only "brought to life" through ambient, GPU-friendly animation
 * (transforms + opacity + a faint brightness pulse — no WebGL, no layout
 * animation, no changes to the robot's shape or appearance).
 *
 * To swap in a different file, change ROBOT_IMAGE_SRC to the path of the
 * uploaded PNG (e.g. a file dropped into `public/` or `src/assets/`).
 */
export const ROBOT_IMAGE_SRC = "/robot.png";

type Particle = {
  left: number; // horizontal start position (%)
  bottom: number; // vertical start position (%)
  size: number; // dot diameter (px)
  delay: number; // animation delay (s)
  duration: number; // drift duration (s)
  driftX: number; // horizontal sway while rising (px)
  opacity: number; // peak opacity
};

function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    left: 8 + ((i * 37) % 84), // spread across the scene
    bottom: 4 + ((i * 23) % 70),
    size: 2 + ((i * 13) % 10) / 2, // 2–6px
    delay: (i * 1.7) % 12,
    duration: 8 + ((i * 7) % 9), // 8–16s
    driftX: ((i % 2 === 0 ? 1 : -1) * (4 + (i % 5) * 3)), // ±4–16px sway
    opacity: 0.25 + ((i * 11) % 30) / 100, // 0.25–0.55
  }));
}

export function HeroRobot({ imageSrc }: { imageSrc?: string }) {
  const reduce = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Scalars read at animation time (refs keep the transform closures fresh
  // when the viewport or the reduced-motion preference changes).
  const parRef = useRef(1); // cursor parallax intensity
  const scrollRef = useRef(1); // scroll parallax intensity
  useEffect(() => {
    parRef.current = reduce ? 0 : isMobile ? 0.5 : 1;
    scrollRef.current = reduce ? 0 : isMobile ? 0.45 : 1;
  }, [reduce, isMobile]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const particles = useMemo(
    () => buildParticles(isMobile ? 6 : 13),
    [isMobile],
  );

  // Prefer an explicitly uploaded URL (e.g. the admin "Homepage hero image"),
  // otherwise the direct project file at ROBOT_IMAGE_SRC.
  const src =
    typeof imageSrc === "string" && imageSrc.trim() ? imageSrc : ROBOT_IMAGE_SRC;

  // Reset the failed state whenever the source changes. On first render the
  // Convex query hasn't arrived yet, so the image tries the /robot.png
  // fallback, 404s and flips the placeholder — and the admin-uploaded URL
  // arriving a moment later must be able to recover from that, otherwise the
  // placeholder sticks forever even though the upload succeeded.
  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  // ---------------------------------------------------------------- parallax
  // Cursor: normalized -1..1 across the scene, smoothed with springs so the
  // robot eases toward the pointer instead of snapping.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 42, damping: 16, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 42, damping: 16, mass: 0.6 });
  const { scrollY } = useScroll();

  const clampScroll = (v: number) => Math.min(Math.max(v, 0), 800) / 800;

  // Robot drifts up slightly as the page scrolls; glow + particles move at
  // their own depths in the opposite direction.
  const robotX = useTransform(sx, (v) => v * 7 * parRef.current);
  const robotCursorY = useTransform(sy, (v) => v * 5 * parRef.current);
  const robotScrollY = useTransform(
    scrollY,
    (v) => -clampScroll(v) * 30 * scrollRef.current,
  );
  const robotY = useTransform(
    [robotCursorY, robotScrollY],
    (vals: number[]) => vals[0] + vals[1],
  );

  const glowX = useTransform(sx, (v) => -v * 14 * parRef.current);
  const glowY = useTransform(
    [sy, scrollY],
    (vals: number[]) =>
      -vals[0] * 10 * parRef.current + clampScroll(vals[1]) * 48 * scrollRef.current,
  );

  const partX = useTransform(sx, (v) => -v * 22 * parRef.current);
  const partY = useTransform(
    [sy, scrollY],
    (vals: number[]) =>
      -vals[0] * 15 * parRef.current + clampScroll(vals[1]) * 22 * scrollRef.current,
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === "touch") return;
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };

  const handlePointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const entranceTransition = reduce
    ? { duration: 0 }
    : { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      ref={sceneRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative mx-auto w-full max-w-xs sm:max-w-sm lg:max-w-lg lg:-mr-6 xl:max-w-xl xl:-mr-10"
      aria-label="The ForgeX robot mascot"
    >
      {/* Neon glow — soft electric-lime halo pulsing behind the robot */}
      <motion.div
        aria-hidden
        style={{ x: glowX, y: glowY }}
        className="pointer-events-none absolute inset-0 z-0"
      >
        <div className="hero-glow-pulse absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(192,253,2,0.24),rgba(192,253,2,0.09)_46%,transparent_72%)] blur-3xl" />
        </div>
      </motion.div>

      {/* Floating particles — sparse, subtle, always behind the robot */}
      <motion.div
        aria-hidden
        style={{ x: partX, y: partY }}
        className="pointer-events-none absolute inset-0 z-0"
      >
        {particles.map((p, i) => (
          <span
            key={i}
            className="hero-particle absolute rounded-full bg-lime-300"
            style={
              {
                left: `${p.left}%`,
                bottom: `${p.bottom}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                "--p-duration": `${p.duration}s`,
                "--p-drift-x": `${p.driftX}px`,
                "--p-opacity": p.opacity,
                boxShadow: "0 0 8px rgba(192,253,2,0.5)",
              } as React.CSSProperties
            }
          />
        ))}
      </motion.div>

      {/* Ground shadow — anchors the hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-4 left-1/2 z-0 h-10 w-3/5 -translate-x-1/2 rounded-[100%] bg-black/60 blur-2xl"
      />

      {/* Robot — cinematic entrance, then cursor + scroll parallax */}
      <motion.div
        initial={{ opacity: 0, y: 44, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={entranceTransition}
        className="relative z-10"
      >
        <motion.div style={{ x: robotX, y: robotY }} className="relative">
          {/* Floating + gentle rotation */}
          <div className="hero-robot-float will-change-transform">
            {/* Breathing idle scale */}
            <div className="hero-robot-breath will-change-transform">
              <div className="drop-shadow-[0_24px_48px_rgba(0,0,0,0.55)]">
                {imgFailed ? (
                  <div className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-lime-400/30 bg-lime-400/5 text-center">
                    <p className="font-display text-2xl font-bold text-lime-300">
                      ForgeX
                    </p>
                    <p className="mt-2 max-w-[220px] px-4 text-xs text-muted-foreground">
                      Robot mascot PNG goes here — place it at{" "}
                      <code className="text-lime-300">public/robot.png</code>
                    </p>
                  </div>
                ) : (
                  <img
                    src={src}
                    alt="ForgeX robot mascot"
                    draggable={false}
                    onError={() => setImgFailed(true)}
                    className="hero-robot-img pointer-events-none h-auto w-full select-none"
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
