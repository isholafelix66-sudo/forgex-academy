import type { ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Camera,
  CircleIcon,
  Code2,
  Compass,
  Database,
  Globe,
  GraduationCap,
  Heart,
  Layers,
  Map,
  Megaphone,
  Palette,
  Rocket,
  Search,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Categories and roadmaps store their icon as a lucide icon NAME string
 * (set from the admin panel, e.g. "Palette" or "Code2"). This component
 * resolves that name to a real icon — never rendering the raw text — and
 * tints it with the category's stored color. Unknown names fall back to a
 * neutral circle so the UI never breaks when an admin types a new icon.
 */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Palette,
  Code2,
  BrainCircuit: Brain,
  Briefcase,
  Megaphone,
  Map,
  BookOpen,
  Rocket,
  Users,
  Globe,
  GraduationCap,
  Target,
  Zap,
  Layers,
  Compass,
  Database,
  BarChart3,
  Heart,
  Sparkles,
  Search,
  Star,
  Trophy,
  Camera,
  Circle: CircleIcon,
};

const COLOR_TEXT: Record<string, string> = {
  lime: "text-lime-300",
  violet: "text-violet-300",
  cyan: "text-cyan-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  sky: "text-sky-300",
  fuchsia: "text-fuchsia-300",
};

export function CategoryIcon({
  name,
  color = "lime",
  className,
}: {
  name?: string | null;
  color?: string | null;
  className?: string;
}) {
  const Icon = (name && ICONS[name]) || CircleIcon;
  return (
    <Icon
      aria-hidden
      className={cn(className, COLOR_TEXT[color ?? ""] ?? "text-lime-300")}
    />
  );
}