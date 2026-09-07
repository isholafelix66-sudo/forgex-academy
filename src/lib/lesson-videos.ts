/**
 * Real, embeddable YouTube lessons for the seeded catalog, keyed by course
 * slug → video per lesson order (1-based). These are genuine educational
 * tutorials that play right in the lesson player.
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
};

/** Host of the seeded placeholder clips (sample movies, not educational). */
const PLACEHOLDER_HOST = "commondatastorage.googleapis.com/gtv-videos-bucket";

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
  // Respect any video a tutor/admin set — only replace seeded placeholders.
  if (storedUrl && !storedUrl.includes(PLACEHOLDER_HOST)) return storedUrl;
  return real;
}