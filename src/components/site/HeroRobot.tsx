import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
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
 * Life is layered AROUND the image:
 *   - float / breath / weight-shift (whole-body transforms)
 *   - a laptop screen light + typing micro-jitter while "working"
 *   - an occasional greeting: robot pauses, eye-brightens, a holographic
 *     "Ready to learn?" micro-message appears, a small confident pulse
 *   - subtle reactions to the hero CTAs (look toward the button, glow) —
 *     purely visual, never intercepting clicks or navigation
 *
 * The component is homepage-only (rendered solely from `Landing`), unmounts
 * on every other route, and every loop is suppressed for
 * prefers-reduced-motion.
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

type Mood = "working" | "greeting" | "thumbsup";

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

  // ------------------------------------------------------ "alive" choreography
  // Working → greeting → thumbs-up, then back to working. The cycle is long
  // so the robot mostly just works quietly; the interaction is occasional.
  const [mood, setMood] = useState<Mood>("working");
  const [message, setMessage] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (reduce) return;
    const t = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
    };
    const cycle = () => {
      // Pause the typing, slowly turn toward the visitor, eyes brighten.
      t(() => setMood("greeting"), 4800);
      // The holographic micro-message.
      t(() => setMessage(true), 6100);
      // Small confident pulse.
      t(() => setMood("thumbsup"), 8000);
      // Message fades away.
      t(() => setMessage(false), 8900);
      // Back to work.
      t(() => setMood("working"), 9700);
      // Next moment — keep it occasional, never constant.
      t(cycle, 17500);
    };
    t(cycle, 0);
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [reduce]);

  // Greeting/thumbs-up eye-brighten (a soft lighting change, never geometry).
  const eyeBright = useMotionValue(0);
  const sEye = useSpring(eyeBright, { stiffness: 90, damping: 20 });
  useEffect(() => {
    eyeBright.set(
      mood === "greeting" ? 0.055 : mood === "thumbsup" ? 0.045 : 0,
    );
  }, [mood, eyeBright]);

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

  // --------------------------------------------------------- CTA observation
  // The robot watches the hero CTAs (purely visual — clicks are never
  // intercepted; the existing button flows run exactly as before).
  const ctaTilt = useMotionValue(0); // -1.4deg toward the CTA on hover
  const ctaGlow = useMotionValue(0); // 0..1 — eye/glow brighten
  const sTilt = useSpring(ctaTilt, { stiffness: 120, damping: 18 });
  const sGlow = useSpring(ctaGlow, { stiffness: 80, damping: 16 });

  useEffect(() => {
    if (reduce) return;
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-hero-cta]"),
    );
    const onEnter = () => {
      ctaTilt.set(-1.4);
      ctaGlow.set(1);
    };
    const onLeave = () => {
      ctaTilt.set(0);
      ctaGlow.set(0);
    };
    const onClick = () => {
      // Brief acknowledgment only — navigation is untouched.
      ctaGlow.set(1);
      const id = window.setTimeout(() => ctaGlow.set(0), 420);
      timersRef.current.push(id);
    };
    els.forEach((el) => {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("focusin", onEnter);
      el.addEventListener("mouseleave", onLeave);
      el.addEventListener("focusout", onLeave);
      el.addEventListener("click", onClick);
    });
    return () => {
      els.forEach((el) => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("focusin", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        el.removeEventListener("focusout", onLeave);
        el.removeEventListener("click", onClick);
      });
    };
  }, [reduce, ctaTilt, ctaGlow]);

  const glowOpacity = useTransform(sGlow, (v) => 1 + v * 0.35);
  const brightFilter = useTransform(
    [sEye, sGlow],
    (vals: number[]) => `brightness(${(1 + vals[0] + vals[1] * 0.045).toFixed(3)})`,
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

  // Thumbs-up sparkle burst — tiny additive dots that pop around the robot's
  // upper body once during the confident moment.
  const sparkles = [
    { left: "27%", top: "26%", "--sx": "-14px", "--sy": "-12px" },
    { left: "68%", top: "22%", "--sx": "12px", "--sy": "-14px" },
    { left: "46%", top: "12%", "--sx": "2px", "--sy": "-16px" },
  ];

  return (
    <div
      ref={sceneRef}
      data-mood={mood}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative mx-auto w-full max-w-xs sm:max-w-sm lg:max-w-lg lg:-mr-6 xl:max-w-xl xl:-mr-10"
      aria-label="The ForgeX robot mascot"
    >
      {/* Neon glow — soft electric-lime halo pulsing behind the robot */}
      <motion.div
        aria-hidden
        style={{ x: glowX, y: glowY, opacity: glowOpacity }}
        className="pointer-events-none absolute inset-0 z-0"
      >
        <div className="hero-glow-pulse absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(192,253,2,0.24),rgba(192,253,2,0.09)_46%,transparent_72%)] blur-3xl" />
        </div>
      </motion.div>

      {/* Laptop screen light — faint additive lime glow, pulses while the
          robot is "working". Sits behind the robot, never alters the image. */}
      <div aria-hidden className="hero-laptop-light" />

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

      {/* Holographic "Ready to learn?" micro-message */}
      <AnimatePresence>
        {message && !reduce && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute right-0 top-2 z-20"
          >
            <div className="hero-message relative flex items-center gap-2 rounded-full border border-lime-400/30 bg-[#0b0f0c]/75 px-3.5 py-1.5 shadow-[0_0_28px_rgba(192,253,2,0.22)] backdrop-blur-md">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-lime-400" />
              </span>
              <span className="font-display text-xs font-semibold tracking-wide text-lime-200">
                Ready to learn?
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Robot — cinematic entrance, then cursor + scroll parallax */}
      <motion.div
        initial={{ opacity: 0, y: 44, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={entranceTransition}
        className="relative z-10"
      >
        <motion.div style={{ x: robotX, y: robotY }} className="relative">
          {/* Subtle look-toward-CTA rotation (transform only) */}
          <motion.div style={{ rotate: sTilt }} className="relative will-change-transform">
            {/* Floating + gentle rotation */}
            <div className="hero-robot-float will-change-transform">
              {/* Typing micro-jitter while working */}
              <div className="hero-robot-work will-change-transform">
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
                      <motion.div style={{ filter: brightFilter }} className="relative">
                        <img
                          src={src}
                          alt="ForgeX robot mascot"
                          draggable={false}
                          onError={() => setImgFailed(true)}
                          className="hero-robot-img pointer-events-none h-auto w-full select-none"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Thumbs-up sparkle burst — only active during the confident moment */}
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
          {sparkles.map((s, i) => (
            <span
              key={i}
              className="hero-sparkle"
              style={
                {
                  left: s.left,
                  top: s.top,
                  "--sx": s["--sx"],
                  "--sy": s["--sy"],
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
