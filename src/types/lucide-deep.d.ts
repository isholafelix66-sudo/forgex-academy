/**
 * Ambient types for lucide-react deep imports used by src/lib/lucide.ts.
 *
 * Each icon file (`lucide-react/dist/esm/icons/<name>.js`) ships no
 * declaration file of its own, so TypeScript would otherwise reject the
 * deep imports. The type mirrors what the real lucide-react barrel
 * declares for every icon component.
 */
declare module "lucide-react/dist/esm/icons/*" {
  import type { LucideProps } from "lucide-react";
  import type { ForwardRefExoticComponent, RefAttributes } from "react";
  const Icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
  export default Icon;
}
