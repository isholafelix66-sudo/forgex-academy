import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, FolderKanban, Loader2, Mail, Share2, Wrench } from "lucide-react";
import { Avatar } from "@/components/site/Avatar";
import { SafeImage } from "@/components/site/SafeImage";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PublicProject() {
  const { slug = "", projectId = "" } = useParams();
  const viewerToken = getPortfolioUserToken();
  const data = useQuery(api.projects.publicPortfolio, viewerToken ? { slug, viewerToken } : { slug });
  const project = data?.status === "ok" ? data.projects.find((item) => item._id === projectId) : undefined;
  const portfolio = data?.status === "ok" ? data.portfolio : undefined;

  if (data === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-[#070906]"><Loader2 className="size-6 animate-spin text-lime-300" /></div>;
  }
  if (!portfolio || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070906] px-4 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <FolderKanban className="mx-auto size-8 text-lime-300" />
          <h1 className="mt-4 text-xl font-bold">Project not found</h1>
          <p className="mt-2 text-sm text-white/55">This project may have been removed or is no longer public.</p>
          <Button asChild className="mt-6 bg-lime-400 text-black hover:bg-lime-300"><Link to={`/p/${slug}`}>Back to portfolio</Link></Button>
        </div>
      </div>
    );
  }

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: project.title, url });
      else await navigator.clipboard.writeText(url);
      toast.success("Project link ready to share.");
    } catch { /* user cancelled sharing */ }
  };

  return (
    <div className="min-h-screen bg-[#070906] text-[#f2f6ec]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070906]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={`/p/${slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-lime-300"><ArrowLeft className="size-4" /> {portfolio.displayName}</Link>
          <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 px-3 py-1.5 text-xs font-semibold text-lime-300 transition-colors hover:bg-lime-400/10"><Share2 className="size-3.5" /> Share</button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_260px] lg:items-start">
          <article>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">{project.category || "Project"}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{project.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">{project.summary}</p>
            {project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-full bg-lime-400 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-lime-300">Visit live project <ArrowUpRight className="size-4" /></a>}
            <div className="mt-10 overflow-hidden rounded-3xl border border-white/10"><SafeImage src={project.imageUrl} alt={project.title} className="aspect-[16/10] w-full object-cover" fallback={<div className="flex aspect-[16/10] items-center justify-center bg-lime-400/10"><FolderKanban className="size-12 text-lime-300" /></div>} /></div>
            {project.description && <div className="prose prose-invert mt-10 max-w-none"><h2 className="font-display text-2xl text-white">The brief</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-white/65">{project.description}</p></div>}
          </article>
          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-3"><Avatar name={portfolio.displayName} image={portfolio.avatarUrl} className="size-11" /><div><p className="font-semibold">{portfolio.displayName}</p><p className="text-xs text-white/50">{portfolio.headline || "Portfolio creator"}</p></div></div><Link to={`/p/${slug}#contact`} className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white/75 transition-colors hover:border-lime-400/40 hover:text-lime-300"><Mail className="size-4" /> Hire {portfolio.displayName.split(" ")[0]}</Link></div>
            {project.tags.length > 0 && <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><Wrench className="size-4 text-lime-300" /> Tools used</h2><div className="mt-3 flex flex-wrap gap-2">{project.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65"><Check className="mr-1 inline size-3 text-lime-300" />{tag}</span>)}</div></div>}
            {project.year && <div className="flex items-center gap-2 px-1 text-xs text-white/45"><CalendarDays className="size-4" /> {project.year}</div>}
          </aside>
        </div>
      </main>
      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/40">Part of a portfolio built with ForgeX Network.</footer>
    </div>
  );
}
