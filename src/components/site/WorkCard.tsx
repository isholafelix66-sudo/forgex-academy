import { Link } from "react-router";
import { motion } from "framer-motion";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { ArrowRight, ArrowUpRight, FolderKanban, Star } from "lucide-react";
import { Avatar } from "./Avatar";
import { SafeImage } from "./SafeImage";
import { Reveal } from "./Reveal";

/** One showcased project, exactly as the Explore/Home queries return it. */
export type WorkItem = FunctionReturnType<
  typeof api.projects.exploreProjects
>[number];

/**
 * A single piece of showcased work with its creator attached — the card the
 * Home page and Explore both use. Image left, copy right, creator row, arrow
 * action; stacks vertically on the smallest screens.
 */
export function WorkCard({
  project,
  delay = 0,
  eager = false,
}: {
  project: WorkItem;
  delay?: number;
  eager?: boolean;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <motion.article
        whileHover={{ y: -3 }}
        transition={{ duration: 0.2 }}
        className="group h-full"
      >
        <Link
          to={`/p/${project.owner.slug}`}
          className="flex h-full gap-3 rounded-2xl border border-white/10 bg-card p-3 transition-colors hover:border-lime-400/35 sm:gap-4 sm:rounded-3xl sm:p-4"
        >
          <div className="relative w-28 shrink-0 overflow-hidden rounded-xl sm:w-44 sm:rounded-2xl lg:w-52">
            <SafeImage
              src={project.imageUrl ?? undefined}
              alt={project.title}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="h-24 w-full object-cover sm:h-36 lg:h-40"
              fallback={
                <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-lime-400/25 to-emerald-500/5 sm:h-36 lg:h-40">
                  <FolderKanban className="size-7 text-lime-300/80" />
                </div>
              }
            />
            {project.featured && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-lime-300 backdrop-blur">
                <Star className="size-2.5 fill-lime-400 text-lime-400" /> Featured
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {project.category && (
              <span className="mb-1.5 w-fit rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-300">
                {project.category}
              </span>
            )}

            <h3 className="font-display text-base font-bold leading-snug tracking-tight sm:text-lg">
              {project.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {project.summary}
            </p>

            {project.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto flex items-center gap-2.5 pt-4">
              <Avatar
                name={project.owner.displayName}
                image={project.owner.avatarUrl ?? undefined}
                className="size-8"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {project.owner.displayName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {project.owner.headline || "Creator"}
                </p>
              </div>
              <span
                aria-hidden
                className={
                  project.liveUrl
                    ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lime-300 transition-colors group-hover:bg-lime-400 group-hover:text-black"
                    : "flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground transition-colors group-hover:bg-lime-400 group-hover:text-black"
                }
              >
                {project.liveUrl ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
              </span>
            </div>
          </div>
        </Link>
      </motion.article>
    </Reveal>
  );
}
