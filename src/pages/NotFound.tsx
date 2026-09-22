import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";

export default function NotFound() {
  return (
    <PageShell>
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <Reveal>
          <p className="font-display text-8xl font-bold text-gradient">404</p>
          <h1 className="font-display mt-4 text-3xl font-bold">
            This link doesn't exist
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            The page you're looking for isn't here — but plenty of portfolios
            are. Try Explore, or head back home.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/">
              <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Back to home
              </Button>
            </Link>
            <Link to="/explore">
              <Button variant="outline" className="border-white/15 hover:border-lime-400/40 hover:text-lime-300">
                Explore portfolios
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
