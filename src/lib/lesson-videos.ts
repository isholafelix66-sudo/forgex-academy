/**
 * Real, embeddable YouTube lessons for the seeded catalog, keyed by course
 * slug → video per lesson order (1-based). These are genuine educational
 * tutorials that play right in the lesson player (all verified embeddable).
 *
 * The resolver only substitutes a video when the stored lesson still points
 * at the seeded placeholder clips — a video a tutor or admin actually set on
 * the lesson always wins.
 */
export const LESSON_VIDEO_FALLBACKS: Record<string, string[]> = {
  "ui-design-mastery": [
    // 1. Information Architecture
    "https://www.youtube.com/watch?v=SjbQ21klQP8",
    // 2. Wireframes & Low-Fi Prototypes
    "https://www.youtube.com/watch?v=6t_dYhXyYjI",
    // 3. High-Fidelity UI in Figma
    "https://www.youtube.com/watch?v=XT59i0Nyq-c",
    // 4. Design Systems & Components
    "https://www.youtube.com/watch?v=_uva2dQPlV8",
    // 5. Prototyping & Handoff
    "https://www.youtube.com/watch?v=E-H06QNkHTU",
    // 6. Usability Testing Basics
    "https://www.youtube.com/watch?v=EYUL0N1Fjhg",
  ],
  "design-fundamentals": [
    "https://www.youtube.com/watch?v=YqQx75OPRa0",
    "https://www.youtube.com/watch?v=MshxnTQW4qU",
    "https://www.youtube.com/watch?v=_2LLXnUdUIc",
    "https://www.youtube.com/watch?v=sByzHoiYFX0",
    "https://www.youtube.com/watch?v=a5KYlHNKQB8",
    "https://www.youtube.com/watch?v=tvYDYtQhreo",
  ],
  "branding-essentials": [
    "https://www.youtube.com/watch?v=5D8sWNq-WUI",
    "https://www.youtube.com/watch?v=NPqEdQDraho",
    "https://www.youtube.com/watch?v=4MxRhjHmiVw",
    "https://www.youtube.com/watch?v=VTDycrlT1hI",
    "https://www.youtube.com/watch?v=4n7dC8AcfH8",
  ],
  "portfolio-career-launchpad": [
    "https://www.youtube.com/watch?v=cqHM7pay82E",
    "https://www.youtube.com/watch?v=mmgxspm9JWs",
    "https://www.youtube.com/watch?v=Y7wD38n7yl4",
    "https://www.youtube.com/watch?v=RYssJ_m60vE",
  ],
  "html-css-the-modern-web": [
    "https://www.youtube.com/watch?v=KVBfmtQ2Wlk",
    "https://www.youtube.com/watch?v=kX3TfdUqpuU",
    "https://www.youtube.com/watch?v=yfoY53QXEnI",
    "https://www.youtube.com/watch?v=z62f2k38s64",
    "https://www.youtube.com/watch?v=69IbzTWg5PM",
    "https://www.youtube.com/watch?v=RGOj5yH7evk",
  ],
  "javascript-deep-dive": [
    "https://www.youtube.com/watch?v=L9-3VBOjNH4",
    "https://www.youtube.com/watch?v=1S8SBDhA7HA",
    "https://www.youtube.com/watch?v=5fb2aPlgoys",
    "https://www.youtube.com/watch?v=8MoElay6dWU",
    "https://www.youtube.com/watch?v=VmQ6dHvnKIM",
    "https://www.youtube.com/watch?v=s9kNndJLOjg",
  ],
  "backend-apis-with-node": [
    "https://www.youtube.com/watch?v=Q-BpqyOT3a8",
    "https://www.youtube.com/watch?v=32M1al-Y6Ag",
    "https://www.youtube.com/watch?v=_7UQPve99r4",
    "https://www.youtube.com/watch?v=favjC6EKFgw",
    "https://www.youtube.com/watch?v=8gHEv5iNRKk",
    "https://www.youtube.com/watch?v=5aryMKiBEKY",
  ],
  "full-stack-project-build-an-lms": [
    "https://www.youtube.com/watch?v=9aZcnf2_py0",
    "https://www.youtube.com/watch?v=xsg9BDiwiJE",
    "https://www.youtube.com/watch?v=305q6IJHy0w",
    "https://www.youtube.com/watch?v=O3BUHwfHf84",
    "https://www.youtube.com/watch?v=8Xwq35cPwYg",
    "https://www.youtube.com/watch?v=l134cBAJCuc",
  ],
  "data-analytics-foundations": [
    "https://www.youtube.com/watch?v=lgCNTuLBMK4",
    "https://www.youtube.com/watch?v=ItZlTixh6Bs",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY",
    "https://www.youtube.com/watch?v=Hfx1X9WSGYQ",
  ],
  "sql-data-wrangling": [
    "https://www.youtube.com/watch?v=h0nxCDiD-zg",
    "https://www.youtube.com/watch?v=2HVMiPPuPIM",
    "https://www.youtube.com/watch?v=nNrgRVIzeHg",
    "https://www.youtube.com/watch?v=K1WeoKxLZ5o",
    "https://www.youtube.com/watch?v=gMymeinwF8A",
    "https://www.youtube.com/watch?v=bMtuPFLCljg",
  ],
  "machine-learning-essentials": [
    "https://www.youtube.com/watch?v=ZyhVh-qRZPA",
    "https://www.youtube.com/watch?v=-o3AxdVcUtQ",
    "https://www.youtube.com/watch?v=O2Cw82YR5Bo",
    "https://www.youtube.com/watch?v=J5bXOOmkopc",
    "https://www.youtube.com/watch?v=C-Cd2ZGXBH4",
    "https://www.youtube.com/watch?v=pYVScuY-GPk",
  ],
  "marketing-fundamentals": [
    "https://www.youtube.com/watch?v=O9j9aLo9waY",
    "https://www.youtube.com/watch?v=v6EWN4EjHM0",
    "https://www.youtube.com/watch?v=SI0XD9e9Tl8",
    "https://www.youtube.com/watch?v=OD-GVCZvcTU",
    "https://www.youtube.com/watch?v=VnbaIbo6z5k",
  ],
  "growth-performance-marketing": [
    "https://www.youtube.com/watch?v=NFAxZg1cGwA",
    "https://www.youtube.com/watch?v=16-dF2p0kKo",
    "https://www.youtube.com/watch?v=hcPxMuxh5Tc",
    "https://www.youtube.com/watch?v=KZe0C0Qq4p0",
    "https://www.youtube.com/watch?v=pRKpaZJJRxk",
    "https://www.youtube.com/watch?v=LQ2eyBztSAs",
  ],
  "entrepreneurship-lean-startups": [
    "https://www.youtube.com/watch?v=9bPgNEDdX3E",
    "https://www.youtube.com/watch?v=KD1NcMTyKs4",
    "https://www.youtube.com/watch?v=1FoCbbbcYT8",
    "https://www.youtube.com/watch?v=AMKgcBzK7cg",
    "https://www.youtube.com/watch?v=Tk-RdCFSrKU",
  ],
  // Professional Graphic Design — client workflow, branding, campaigns, capstone.
  "professional-graphic-design": [
    "https://www.youtube.com/watch?v=tvYDYtQhreo",
    "https://www.youtube.com/watch?v=5D8sWNq-WUI",
    "https://www.youtube.com/watch?v=4MxRhjHmiVw",
    "https://www.youtube.com/watch?v=VTDycrlT1hI",
    "https://www.youtube.com/watch?v=NPqEdQDraho",
    "https://www.youtube.com/watch?v=YqQx75OPRa0",
    "https://www.youtube.com/watch?v=a5KYlHNKQB8",
    "https://www.youtube.com/watch?v=MshxnTQW4qU",
    "https://www.youtube.com/watch?v=cqHM7pay82E",
  ],
  // Photoshop Mastery — interface, layers, masks, selections, pen, retouching.
  "photoshop-mastery": [
    "https://www.youtube.com/watch?v=PeD7uhc8R4U",
    "https://www.youtube.com/watch?v=PeD7uhc8R4U",
    "https://www.youtube.com/watch?v=fE1_nHllIp8",
    "https://www.youtube.com/watch?v=0qcWeuWCkJ4",
    "https://www.youtube.com/watch?v=dvJ1HxlyEfI",
    "https://www.youtube.com/watch?v=TEQOd6fRSiI",
    "https://www.youtube.com/watch?v=zKiSUBWAObA",
    "https://www.youtube.com/watch?v=yeQR0qAl_-k",
    "https://www.youtube.com/watch?v=Xt39PClmo4U",
    "https://www.youtube.com/watch?v=0qcWeuWCkJ4",
    "https://www.youtube.com/watch?v=Xt39PClmo4U",
    "https://www.youtube.com/watch?v=5dJl_Lr5TGQ",
  ],
  // Video Editing with CapCut — fundamentals, timeline, cuts, music, text, export.
  "video-editing-with-capcut": [
    "https://www.youtube.com/watch?v=TlJR7PAtHks",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=pHMoPh6mzm4",
    "https://www.youtube.com/watch?v=c6wA5sWGX5c",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=c6wA5sWGX5c",
    "https://www.youtube.com/watch?v=bALqRZTgfuY",
    "https://www.youtube.com/watch?v=u3cm1gbHwJU",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=pHMoPh6mzm4",
  ],
  // Build Websites with AI — Bolt.new builds, web fundamentals, CSS/JS, SEO, Git.
  "build-websites-with-ai": [
    "https://www.youtube.com/watch?v=GcH5sn_0Src",
    "https://www.youtube.com/watch?v=KVBfmtQ2Wlk",
    "https://www.youtube.com/watch?v=5zfOitaKfmM",
    "https://www.youtube.com/watch?v=kmN-u7qSKME",
    "https://www.youtube.com/watch?v=1yxmzUslHuo",
    "https://www.youtube.com/watch?v=hdDPXYP3b4k",
    "https://www.youtube.com/watch?v=eMZmDH3T2bY",
    "https://www.youtube.com/watch?v=hdDPXYP3b4k",
    "https://www.youtube.com/watch?v=kX3TfdUqpuU",
    "https://www.youtube.com/watch?v=69IbzTWg5PM",
    "https://www.youtube.com/watch?v=yfoY53QXEnI",
    "https://www.youtube.com/watch?v=z62f2k38s64",
    "https://www.youtube.com/watch?v=L9-3VBOjNH4",
    "https://www.youtube.com/watch?v=xsVTqzratPs",
    "https://www.youtube.com/watch?v=RGOj5yH7evk",
    "https://www.youtube.com/watch?v=eMZmDH3T2bY",
    "https://www.youtube.com/watch?v=1yxmzUslHuo",
  ],
  // Data Analysis with Excel — Alex The Analyst + Kevin Stratvert/Chandoo.
  "data-analysis-with-excel": [
    "https://www.youtube.com/watch?v=lgCNTuLBMK4",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY",
    "https://www.youtube.com/watch?v=_jmiEGZ6PIY",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=ItZlTixh6Bs",
    "https://www.youtube.com/watch?v=Hfx1X9WSGYQ",
    "https://www.youtube.com/watch?v=0aeZX1l4JT4",
    "https://www.youtube.com/watch?v=MMdcczmULrU",
    "https://www.youtube.com/watch?v=ItZlTixh6Bs",
    "https://www.youtube.com/watch?v=Hfx1X9WSGYQ",
    "https://www.youtube.com/watch?v=lgCNTuLBMK4",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
  ],
  // AI Video Generation & Content Creation — Runway, ElevenLabs, CapCut.
  "ai-video-generation-content-creation": [
    "https://www.youtube.com/watch?v=c38vtLw1nSk",
    "https://www.youtube.com/watch?v=FqYRkl12ON8",
    "https://www.youtube.com/watch?v=-og75MUlnFk",
    "https://www.youtube.com/watch?v=w_kKWDyPZnI",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=-og75MUlnFk",
    "https://www.youtube.com/watch?v=CrvraynXNe4",
    "https://www.youtube.com/watch?v=CrvraynXNe4",
    "https://www.youtube.com/watch?v=yDTbAxJ3sKI",
    "https://www.youtube.com/watch?v=bALqRZTgfuY",
    "https://www.youtube.com/watch?v=ImKkcOE3y70",
    "https://www.youtube.com/watch?v=c6wA5sWGX5c",
    "https://www.youtube.com/watch?v=-og75MUlnFk",
    "https://www.youtube.com/watch?v=u3cm1gbHwJU",
    "https://www.youtube.com/watch?v=TlJR7PAtHks",
    "https://www.youtube.com/watch?v=-og75MUlnFk",
    "https://www.youtube.com/watch?v=c38vtLw1nSk",
    "https://www.youtube.com/watch?v=-og75MUlnFk",
  ],
  // AI Automation & Productivity — Zapier (Kevin Stratvert / MinorCo) + ChatGPT.
  "ai-automation-productivity": [
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=VkzZqLSt2hs",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=VkzZqLSt2hs",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=VkzZqLSt2hs",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=VkzZqLSt2hs",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=VkzZqLSt2hs",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=VkzZqLSt2hs",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
  ],
  // Prompt Engineering — full prompt courses + ChatGPT, Claude Code, Runway, Zapier.
  "prompt-engineering": [
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=eMZmDH3T2bY",
    "https://www.youtube.com/watch?v=DvhFcIRRXyI",
    "https://www.youtube.com/watch?v=-og75MUlnFk",
    "https://www.youtube.com/watch?v=JtdUgJGI_Oo",
    "https://www.youtube.com/watch?v=DvhFcIRRXyI",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
    "https://www.youtube.com/watch?v=YhRfgYH_AoU",
  ],
  // AI Productivity & Digital Work — ChatGPT, Notion AI, Excel.
  "ai-productivity-digital-work": [
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=VSKIS5D-gQg",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=VSKIS5D-gQg",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=zXnQNytHCPM",
    "https://www.youtube.com/watch?v=kOf3QSBV29Y",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=VSKIS5D-gQg",
    "https://www.youtube.com/watch?v=kOf3QSBV29Y",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=g5oEAoKdrdw",
    "https://www.youtube.com/watch?v=VSKIS5D-gQg",
    "https://www.youtube.com/watch?v=VSKIS5D-gQg",
  ],
};

/** Host of the seeded placeholder clips (sample movies, not educational). */
const PLACEHOLDER_HOST = "commondatastorage.googleapis.com/gtv-videos-bucket";

/**
 * Sentinel stored on lessons that deliberately ship without a recording yet
 * (the AI & modern-work courses were seeded with it). The resolver replaces
 * it with the real mapped tutorial, so those courses play immediately.
 */
const PLANNED_RECORDING = "planned-recording";

/**
 * Returns the real educational video for a seeded lesson when the stored URL
 * is still a placeholder, otherwise the stored URL unchanged.
 */
export function resolveLessonVideo(
  courseSlug: string | null | undefined,
  lessonOrder: number | undefined,
  storedUrl: string | null | undefined,
): string | null | undefined {
  if (!courseSlug || !lessonOrder) return storedUrl;
  const fallbacks = LESSON_VIDEO_FALLBACKS[courseSlug];
  if (!fallbacks) return storedUrl;
  const real = fallbacks[lessonOrder - 1];
  if (!real) return storedUrl;
  // Respect any video a tutor/admin set — only replace seeded placeholder
  // clips and lessons still marked as "planned recording".
  if (
    storedUrl &&
    !storedUrl.includes(PLACEHOLDER_HOST) &&
    storedUrl !== PLANNED_RECORDING
  ) {
    return storedUrl;
  }
  return real;
}