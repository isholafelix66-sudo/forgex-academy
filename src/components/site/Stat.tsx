import { Reveal } from "./Reveal";

export function Stat({
  value,
  label,
  delay = 0,
}: {
  value: string;
  label: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="text-center">
      <div className="font-display text-2xl font-bold tracking-tight text-gradient sm:text-4xl lg:text-5xl">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground sm:text-sm">{label}</div>
    </Reveal>
  );
}
