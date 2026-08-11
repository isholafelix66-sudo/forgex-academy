import { motion } from "framer-motion";
import { Link } from "react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Premium animated CTA — wraps a router Link + Button with a soft lift on
 * hover, a gentle press on tap, and a lime sheen that sweeps across primary
 * buttons. GPU-friendly (transform-only, one pseudo-element), respects
 * prefers-reduced-motion, and works on touch (whileTap feedback).
 */
export function AnimatedCta({
  to,
  variant = "primary",
  size = "lg",
  className,
  children,
}: {
  to: string;
  variant?: "primary" | "outline";
  size?: "default" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={cn("inline-block", className)}
    >
      <Link to={to} className="group relative inline-flex">
        <Button
          size={size}
          variant={variant === "outline" ? "outline" : "default"}
          className={cn(
            "relative overflow-hidden",
            variant === "primary" &&
              "bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft cta-shimmer",
            variant === "outline" &&
              "border-white/15 hover:border-lime-400/40 hover:text-lime-300",
          )}
        >
          {children}
        </Button>
      </Link>
    </motion.div>
  );
}
