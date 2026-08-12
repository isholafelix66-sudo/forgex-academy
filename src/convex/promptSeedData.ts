// ---------------------------------------------------------------------------
// ForgeX AI Prompt Library — starter seed data.
//
// This seeds the library ONCE (only when the prompt tables are empty) so the
// first launch ships with curated Design & Creative prompts. After seeding,
// everything lives in the database and is fully managed from the admin
// portal — the frontend never hardcodes any of this.
// ---------------------------------------------------------------------------

export type PromptSeedField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  required?: boolean;
};

export type PromptSeed = {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  difficulty?: "beginner" | "intermediate" | "advanced" | "professional" | "expert";
  usefulFor: string;
  requiredInputs: string[];
  template: string;
  fields: PromptSeedField[];
  featured?: boolean;
  views: number;
};

export const PROMPT_CATEGORIES: Array<{
  name: string;
  description: string;
  subcategories: string[];
}> = [
  {
    name: "Graphic Design",
    description: "Print and digital design craft — cards, covers, menus and thumbnails.",
    subcategories: ["Print", "Digital", "Social graphics"],
  },
  {
    name: "Branding",
    description: "Build identities people remember — strategy, palettes and full identity systems.",
    subcategories: ["Identity systems", "Color palettes", "Brand voice"],
  },
  {
    name: "Logo Design",
    description: "Marks, monograms and wordmarks that scale from favicon to billboard.",
    subcategories: ["Minimal marks", "Monograms", "Wordmarks"],
  },
  {
    name: "UI/UX Design",
    description: "Interfaces and experiences — mobile apps, websites and design systems.",
    subcategories: ["Mobile apps", "Websites", "Design systems"],
  },
  {
    name: "AI Image Generation",
    description: "Generate images with Midjourney, DALL·E, Stable Diffusion and more.",
    subcategories: ["Midjourney", "DALL·E", "Stable Diffusion"],
  },
  {
    name: "Product Photography",
    description: "Studio-quality product, fashion and editorial photography prompts.",
    subcategories: ["E-commerce", "Luxury", "Fashion editorial"],
  },
  {
    name: "Flyer & Poster Design",
    description: "Events, promotions and announcements that grab attention.",
    subcategories: ["Event flyers", "Posters", "Promotions"],
  },
  {
    name: "Packaging Design",
    description: "Premium packaging concepts — from structure to shelf.",
    subcategories: ["Premium", "E-commerce", "Sustainable"],
  },
  {
    name: "Presentation Design",
    description: "Decks that persuade — clean layouts and clear stories.",
    subcategories: ["Business decks", "Pitch decks", "Workshops"],
  },
  {
    name: "Video & Motion",
    description: "Cinematic scenes, ad concepts and motion direction.",
    subcategories: ["Ad concepts", "Social video", "Motion"],
  },
  {
    name: "Creative Concepts",
    description: "Big ideas and out-of-the-box creative directions.",
    subcategories: [],
  },
];

export const PROMPT_SEED: PromptSeed[] = [
  {
    title: "Luxury Product Photography",
    description:
      "Shoot premium products with an editorial, high-end feel — perfect for e-commerce hero shots and campaigns.",
    category: "Product Photography",
    subcategory: "Luxury",
    tags: ["product", "luxury", "e-commerce", "editorial"],
    difficulty: "professional",
    usefulFor:
      "Creating premium, conversion-focused product shots for e-commerce stores, brand campaigns and lookbooks.",
    requiredInputs: [
      "Product name",
      "Product type",
      "Background",
      "Lighting",
      "Camera angle",
      "Mood",
      "Brand style",
      "Image orientation",
    ],
    template:
      "Photograph {{product-name}} ({{product-type}}) for a luxury product campaign. Style the shot on a {{background}} with {{lighting}} to highlight premium materials and fine detail. Compose from a {{camera-angle}} camera angle with a {{mood}} mood, in {{image-orientation}} orientation. The overall aesthetic should feel {{brand-style}} — clean, editorial and refined, with soft reflections, shallow depth of field and generous negative space for post-production. No text overlays or watermarks.",
    fields: [
      { key: "product-name", label: "Product name", type: "text", placeholder: "e.g. Aurora Gold Watch", required: true },
      { key: "product-type", label: "Product type", type: "text", placeholder: "e.g. luxury wristwatch" },
      {
        key: "background",
        label: "Background",
        type: "select",
        options: ["neutral studio backdrop", "marble surface", "dark velvet", "soft gradient", "architectural setting"],
      },
      {
        key: "lighting",
        label: "Lighting",
        type: "select",
        options: ["soft diffused studio light", "dramatic low-key", "golden hour glow", "rim light with fill"],
      },
      {
        key: "camera-angle",
        label: "Camera angle",
        type: "select",
        options: ["eye-level", "45° three-quarter", "overhead flat lay", "low hero angle"],
      },
      {
        key: "mood",
        label: "Mood",
        type: "select",
        options: ["premium & understated", "warm & inviting", "cool & modern", "mysterious & exclusive"],
      },
      { key: "brand-style", label: "Brand style", type: "text", placeholder: "e.g. minimalist with warm gold accents" },
      {
        key: "image-orientation",
        label: "Image orientation",
        type: "select",
        options: ["square 1:1", "portrait 4:5", "landscape 16:9", "vertical 9:16"],
      },
    ],
    featured: true,
    views: 1840,
  },
  {
    title: "Professional Flyer Design",
    description:
      "A structured flyer brief that produces clean, scannable event promotions with a strong call to action.",
    category: "Flyer & Poster Design",
    subcategory: "Event flyers",
    tags: ["flyer", "event", "print", "promotion"],
    difficulty: "intermediate",
    usefulFor:
      "Designing print-ready event flyers — talks, workshops, product launches and community meetups.",
    requiredInputs: ["Event name", "Event type", "Date", "Venue", "Headline", "Color palette", "Style", "Audience"],
    template:
      "Design a professional flyer for {{event-name}}, a {{event-type}} happening on {{date}} at {{venue}}. The headline should read \u201c{{headline}}\u201d and the flyer must clearly show the date, venue and a call to action for a {{audience}} audience. Use a {{color-palette}} color palette in a {{style}} style, with strong visual hierarchy, one focal image and enough whitespace that the information stays scannable. Layout: A5 print-safe with safe margins.",
    fields: [
      { key: "event-name", label: "Event name", type: "text", required: true },
      { key: "event-type", label: "Event type", type: "text", placeholder: "e.g. design workshop" },
      { key: "date", label: "Date", type: "text", placeholder: "e.g. March 14, 2026" },
      { key: "venue", label: "Venue", type: "text" },
      { key: "headline", label: "Headline", type: "text" },
      {
        key: "color-palette",
        label: "Color palette",
        type: "select",
        options: ["bold high-contrast", "black & electric lime", "soft pastels", "warm earthy tones", "monochrome"],
      },
      {
        key: "style",
        label: "Style",
        type: "select",
        options: ["bold & modern", "minimal & elegant", "playful & colorful", "luxury & dark", "vintage & textured"],
      },
      { key: "audience", label: "Audience", type: "text", placeholder: "e.g. university students" },
    ],
    views: 1210,
  },
  {
    title: "Modern Poster Design",
    description:
      "Generate a balanced, contemporary poster layout — bold type, strong contrast and a clear focal point.",
    category: "Flyer & Poster Design",
    subcategory: "Posters",
    tags: ["poster", "print", "typography", "layout"],
    difficulty: "beginner",
    usefulFor:
      "Posters for talks, exhibitions, product drops and campaigns where the message must read from a distance.",
    requiredInputs: ["Subject", "Headline", "Style", "Color palette", "Audience", "Format"],
    template:
      "Create a modern poster for {{subject}}. Lead with the headline \u201c{{headline}}\u201d and design for a {{audience}} audience in {{format}} format. Use a {{style}} visual style with a {{color-palette}} palette — bold typography, strong contrast and a clear focal point. Keep the layout balanced and the message readable from a distance.",
    fields: [
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "headline", label: "Headline", type: "text" },
      {
        key: "style",
        label: "Style",
        type: "select",
        options: ["brutalist & loud", "clean minimal", "art deco", "swiss grid", "organic & fluid"],
      },
      { key: "color-palette", label: "Color palette", type: "text", placeholder: "e.g. electric lime on near-black" },
      { key: "audience", label: "Audience", type: "text" },
      {
        key: "format",
        label: "Format",
        type: "select",
        options: ["A3 portrait", "A2 landscape", "square 1:1", "billboard 3:1"],
      },
    ],
    views: 980,
  },
  {
    title: "Minimalist Logo Concept",
    description:
      "A disciplined logo brief that pushes toward timeless, scalable marks — from favicon to billboard.",
    category: "Logo Design",
    subcategory: "Minimal marks",
    tags: ["logo", "minimal", "branding", "identity"],
    difficulty: "intermediate",
    usefulFor:
      "Exploring minimalist logo directions for startups, personal brands and rebrands that need to feel premium.",
    requiredInputs: ["Brand name", "Industry", "Brand personality", "Symbol direction", "Color palette", "Format"],
    template:
      "Design a minimalist logo concept for {{brand-name}}, a company in the {{industry}} industry. The brand personality is {{brand-personality}}. Explore a {{symbol-direction}} direction using a {{color-palette}} palette, and deliver it as a {{format}}. The mark should be simple enough to work at 16px, timeless rather than trendy, and scale cleanly to signage and app icons. Provide the concept in monochrome and full color.",
    fields: [
      { key: "brand-name", label: "Brand name", type: "text", required: true },
      { key: "industry", label: "Industry", type: "text" },
      { key: "brand-personality", label: "Brand personality", type: "textarea", placeholder: "e.g. confident, precise, quietly premium" },
      {
        key: "symbol-direction",
        label: "Symbol direction",
        type: "select",
        options: ["abstract mark", "letterform / monogram", "geometric icon", "wordmark only", "combination mark"],
      },
      { key: "color-palette", label: "Color palette", type: "text", placeholder: "e.g. black + electric lime" },
      {
        key: "format",
        label: "Format",
        type: "select",
        options: ["primary logo", "secondary mark", "icon only"],
      },
    ],
    featured: true,
    views: 1520,
  },
  {
    title: "Complete Brand Identity",
    description:
      "End-to-end brand strategy brief — positioning, logo system, palette, type, voice and real applications.",
    category: "Branding",
    subcategory: "Identity systems",
    tags: ["branding", "identity", "strategy", "guidelines"],
    difficulty: "advanced",
    usefulFor:
      "Running a full brand identity project — useful for founders, agencies and freelancers scoping a complete deliverable.",
    requiredInputs: ["Brand name", "Industry", "Audience", "Brand values", "Visual style", "Deliverables"],
    template:
      "Develop a complete brand identity for {{brand-name}}, operating in the {{industry}} industry and targeting {{audience}}. Ground the identity in these brand values: {{brand-values}}. The visual style should be {{visual-style}}. Deliverables: {{deliverables}}. Include a brand story, positioning statement, logo system (primary + secondary marks), color palette with hex codes, typography pairing, tone-of-voice guidelines and 3\u20135 mock applications so the brand feels real.",
    fields: [
      { key: "brand-name", label: "Brand name", type: "text", required: true },
      { key: "industry", label: "Industry", type: "text" },
      { key: "audience", label: "Audience", type: "text", placeholder: "e.g. young professionals 22–35" },
      { key: "brand-values", label: "Brand values", type: "textarea", placeholder: "one value per line" },
      { key: "visual-style", label: "Visual style", type: "text", placeholder: "e.g. minimal, editorial, warm" },
      { key: "deliverables", label: "Deliverables", type: "textarea", placeholder: "e.g. logo, palette, type, guidelines, mockups" },
    ],
    featured: true,
    views: 1360,
  },
  {
    title: "Brand Color Palette",
    description:
      "Build an accessible, personality-driven color system with roles, contrast checks and light/dark versions.",
    category: "Branding",
    subcategory: "Color palettes",
    tags: ["color", "palette", "branding", "accessibility"],
    difficulty: "beginner",
    usefulFor:
      "Choosing a cohesive brand palette that passes contrast checks and communicates the right personality.",
    requiredInputs: ["Brand name", "Industry", "Personality", "Mood", "Number of colors"],
    template:
      "Build a {{count}} color palette for {{brand-name}}, a {{industry}} brand with a {{personality}} personality. The overall mood should be {{mood}}. Provide hex codes for each color, explain the role of each (primary, secondary, accent, neutrals), show light and dark background combinations, and confirm the palette passes WCAG AA contrast for body text. Suggest how each color supports the brand personality.",
    fields: [
      { key: "brand-name", label: "Brand name", type: "text", required: true },
      { key: "industry", label: "Industry", type: "text" },
      { key: "personality", label: "Personality", type: "text", placeholder: "e.g. energetic, trustworthy, playful" },
      {
        key: "mood",
        label: "Mood",
        type: "select",
        options: ["bold & energetic", "calm & trustworthy", "premium & minimal", "friendly & playful", "dark & edgy"],
      },
      { key: "count", label: "Number of colors", type: "select", options: ["3 colors", "4 colors", "5 colors"] },
    ],
    views: 870,
  },
  {
    title: "Premium Packaging Design",
    description:
      "A full packaging brief — structure, surface graphics, finish and shelf impact for premium products.",
    category: "Packaging Design",
    subcategory: "Premium",
    tags: ["packaging", "premium", "product", "retail"],
    difficulty: "professional",
    usefulFor:
      "Designing packaging that performs on shelves and in e-commerce photography — structure and finish included.",
    requiredInputs: ["Product", "Product type", "Brand name", "Materials", "Shelf environment", "Style"],
    template:
      "Design premium packaging for {{product}} ({{product-type}}) by {{brand-name}}. Consider materials: {{materials}}; the package will sit on shelves in a {{shelf-environment}} environment. The design should feel {{style}} — premium, tactile and true to the brand. Cover structural format, surface graphics, typography, color, finish (foil, emboss, matte) and how it photographs for e-commerce. Prioritize shelf impact while staying elegant and minimal.",
    fields: [
      { key: "product", label: "Product", type: "text", required: true },
      { key: "product-type", label: "Product type", type: "text" },
      { key: "brand-name", label: "Brand name", type: "text" },
      { key: "materials", label: "Materials", type: "text", placeholder: "e.g. recyclable kraft + soft-touch laminate" },
      { key: "shelf-environment", label: "Shelf environment", type: "text", placeholder: "e.g. premium beauty retail" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. minimal, sculptural, editorial" },
    ],
    featured: true,
    views: 1180,
  },
  {
    title: "Mobile App UI Concept",
    description:
      "A complete UI concept brief — key screens, design system, dark mode and touch-friendly states.",
    category: "UI/UX Design",
    subcategory: "Mobile apps",
    tags: ["ui", "mobile", "app", "design system"],
    difficulty: "intermediate",
    usefulFor:
      "Designing a polished mobile app UI — screens, components and states that hand off cleanly to developers.",
    requiredInputs: ["App name", "App purpose", "Target users", "Platform", "Style", "Key screens"],
    template:
      "Design a mobile app UI concept for {{app-name}}, an app that {{app-purpose}} for {{target-users}}. Platform: {{platform}}. Design style: {{style}}. Create high-fidelity screens for: {{key-screens}}. Include a clear visual hierarchy, consistent spacing and type scale, usable touch targets (44px+), light and dark mode, and a small design-system sheet with the core colors, type and components used across the screens.",
    fields: [
      { key: "app-name", label: "App name", type: "text", required: true },
      { key: "app-purpose", label: "App purpose", type: "text", placeholder: "e.g. helps students track study streaks" },
      { key: "target-users", label: "Target users", type: "text" },
      { key: "platform", label: "Platform", type: "select", options: ["iOS", "Android", "Both"] },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. clean, friendly, data-rich" },
      { key: "key-screens", label: "Key screens", type: "textarea", placeholder: "one screen per line" },
    ],
    featured: true,
    views: 1430,
  },
  {
    title: "Modern Website Landing Page",
    description:
      "A conversion-focused landing page brief — hero, value props, social proof and one clear call to action.",
    category: "UI/UX Design",
    subcategory: "Websites",
    tags: ["web", "landing page", "conversion", "ui"],
    difficulty: "intermediate",
    usefulFor:
      "Structuring and designing landing pages that turn visitors into signups, leads or buyers.",
    requiredInputs: ["Company", "Offering", "Audience", "Goal", "Style", "Sections"],
    template:
      "Design a modern landing page for {{company}}, which offers {{offering}} to {{audience}}. The primary goal is to {{goal}}. Build the page with these sections: {{sections}}. Use a {{style}} visual style — strong typography, a confident hero, clear value props, social proof and a single prominent call to action. Include mobile and desktop layouts, and note the micro-interactions and hover states that make the page feel alive.",
    fields: [
      { key: "company", label: "Company", type: "text", required: true },
      { key: "offering", label: "Offering", type: "text" },
      { key: "audience", label: "Audience", type: "text" },
      { key: "goal", label: "Goal", type: "text", placeholder: "e.g. collect waitlist emails" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. bold, dark, minimal" },
      { key: "sections", label: "Sections", type: "textarea", placeholder: "one section per line" },
    ],
    featured: true,
    views: 1290,
  },
  {
    title: "3D Product Render",
    description:
      "Photorealistic 3D render prompt — environment, lighting, camera and materials for hero imagery.",
    category: "AI Image Generation",
    subcategory: "Midjourney",
    tags: ["3d", "render", "product", "photorealistic"],
    difficulty: "advanced",
    usefulFor:
      "Generating hero product imagery for stores, ads and presentations without a physical photoshoot.",
    requiredInputs: ["Product", "Environment", "Lighting", "Camera", "Material", "Style"],
    template:
      "Generate a photorealistic 3D product render of {{product}} in a {{environment}} environment. Use {{lighting}} lighting with a {{camera}} camera angle. The product surface should feel {{material}} and the overall style should be {{style}}. Render with soft reflections, subtle depth of field, realistic shadows and high detail on texture and edges. Output 4K, no text, no watermark.",
    fields: [
      { key: "product", label: "Product", type: "text", required: true },
      { key: "environment", label: "Environment", type: "text", placeholder: "e.g. minimal beige studio podium" },
      {
        key: "lighting",
        label: "Lighting",
        type: "select",
        options: ["soft studio softbox", "dramatic rim light", "warm golden hour", "cool daylight", "neon accent"],
      },
      {
        key: "camera",
        label: "Camera",
        type: "select",
        options: ["low hero angle", "three-quarter view", "macro close-up", "overhead flat lay"],
      },
      {
        key: "material",
        label: "Material",
        type: "select",
        options: ["brushed metal", "glossy ceramic", "matte rubber", "glass & chrome", "woven fabric"],
      },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. Apple-style minimalism" },
    ],
    views: 1740,
  },
  {
    title: "Cinematic Advertisement Scene",
    description:
      "Direct a cinematic ad scene — shot list, pacing, lighting, camera movement and sound design.",
    category: "Video & Motion",
    subcategory: "Ad concepts",
    tags: ["video", "ad", "cinematic", "direction"],
    difficulty: "advanced",
    usefulFor:
      "Planning a short-form brand film or ad spot — for producers, editors and motion designers.",
    requiredInputs: ["Brand", "Scene", "Mood", "Lighting", "Camera movement", "Runtime"],
    template:
      "Write a cinematic advertisement scene for {{brand}}. The scene: {{scene}}. The mood should be {{mood}} with {{lighting}} lighting. Direct the camera with {{camera-movement}} and cut the spot to {{runtime}}. Include a shot list, pacing notes, sound design direction (music, ambience, SFX) and a final line of on-screen text or voiceover that lands the brand message.",
    fields: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "scene", label: "Scene", type: "textarea", placeholder: "describe the scene beat by beat" },
      { key: "mood", label: "Mood", type: "text", placeholder: "e.g. warm, aspirational, quiet confidence" },
      { key: "lighting", label: "Lighting", type: "text", placeholder: "e.g. golden hour backlight through blinds" },
      { key: "camera-movement", label: "Camera movement", type: "text", placeholder: "e.g. slow dolly-in with handheld inserts" },
      { key: "runtime", label: "Runtime", type: "select", options: ["15s", "30s", "60s"] },
    ],
    views: 890,
  },
  {
    title: "Professional Presentation",
    description:
      "A presentation design brief — structure, storytelling, visuals and a clear call to action.",
    category: "Presentation Design",
    subcategory: "Business decks",
    tags: ["presentation", "deck", "slides", "business"],
    difficulty: "beginner",
    usefulFor:
      "Building persuasive slide decks for pitches, reports, training and workshops.",
    requiredInputs: ["Topic", "Audience", "Goal", "Tone", "Slide count", "Style"],
    template:
      "Design a professional presentation on {{topic}} for a {{audience}} audience. The goal of the deck is to {{goal}}, with a {{tone}} tone. Build {{slide-count}} slides covering: intro/hook, the core content, a clear conclusion and a call to action. Use a {{style}} visual style with consistent type, a restrained color palette, charts and diagrams where they add clarity, and minimal bullet points — let visuals carry the message.",
    fields: [
      { key: "topic", label: "Topic", type: "text", required: true },
      { key: "audience", label: "Audience", type: "text" },
      { key: "goal", label: "Goal", type: "text", placeholder: "e.g. win project approval" },
      { key: "tone", label: "Tone", type: "text", placeholder: "e.g. confident, approachable" },
      { key: "slide-count", label: "Slide count", type: "text", placeholder: "e.g. 12" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. dark + electric lime accents" },
    ],
    featured: true,
    views: 1040,
  },
  {
    title: "Fashion Editorial Photography",
    description:
      "Direct a fashion editorial shoot — styling, lighting, lens and magazine-standard composition.",
    category: "Product Photography",
    subcategory: "Fashion editorial",
    tags: ["fashion", "editorial", "photography", "magazine"],
    difficulty: "professional",
    usefulFor:
      "Planning fashion editorials, lookbooks and brand campaigns with an editorial, magazine feel.",
    requiredInputs: ["Subject", "Outfit", "Setting", "Lighting", "Mood", "Lens"],
    template:
      "Direct a fashion editorial photo of {{subject}} wearing {{outfit}}, shot in a {{setting}} setting. Light the scene with {{lighting}} for a {{mood}} mood. Shoot on a {{lens}} lens and compose with editorial magazine standards — strong poses, intentional negative space and room for typography. Deliver a set of 5\u20138 selects with a consistent grade and no text.",
    fields: [
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "outfit", label: "Outfit", type: "text" },
      { key: "setting", label: "Setting", type: "text", placeholder: "e.g. brutalist concrete courtyard" },
      { key: "lighting", label: "Lighting", type: "text", placeholder: "e.g. overcast diffused daylight + silver bounce" },
      { key: "mood", label: "Mood", type: "text", placeholder: "e.g. effortless, confident, editorial" },
      {
        key: "lens",
        label: "Lens",
        type: "select",
        options: ["35mm", "50mm", "85mm", "medium format"],
      },
    ],
    views: 760,
  },
  {
    title: "Creative Portrait",
    description:
      "Generate a cinematic portrait — painterly detail, color grading and a shallow-depth-of-field look.",
    category: "AI Image Generation",
    subcategory: "DALL·E",
    tags: ["portrait", "ai image", "cinematic", "generative"],
    difficulty: "intermediate",
    usefulFor:
      "Creating striking portrait imagery for covers, social profiles and concept art with AI image tools.",
    requiredInputs: ["Subject", "Setting", "Lighting", "Mood", "Style", "Lens"],
    template:
      "Generate a creative portrait of {{subject}} in a {{setting}} setting with {{lighting}} lighting. The mood should be {{mood}} and the style {{style}}. Photograph with a {{lens}} look — shallow depth of field, painterly detail and cinematic color grading. Portrait orientation, high detail on the face, no watermark.",
    fields: [
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "setting", label: "Setting", type: "text" },
      { key: "lighting", label: "Lighting", type: "text", placeholder: "e.g. single softbox + colored rim light" },
      { key: "mood", label: "Mood", type: "text" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. editorial fine-art" },
      {
        key: "lens",
        label: "Lens",
        type: "select",
        options: ["85mm f/1.4", "50mm f/1.8", "35mm environmental"],
      },
    ],
    views: 990,
  },
  {
    title: "Event Flyer",
    description:
      "A high-visibility event flyer — date, time, venue and ticket link that can't be missed.",
    category: "Flyer & Poster Design",
    subcategory: "Event flyers",
    tags: ["flyer", "event", "tickets", "promotion"],
    difficulty: "beginner",
    usefulFor:
      "Quick, attention-grabbing flyers for concerts, parties, launches and community events.",
    requiredInputs: ["Event name", "Event type", "Date", "Time", "Location", "Ticket link", "Color scheme"],
    template:
      "Design an eye-catching flyer for {{event-name}} — a {{event-type}} on {{date}} at {{time}}, held at {{location}}. The flyer must include the date, time, venue and a scannable QR or ticket link ({{ticket-link}}). Use a {{color-scheme}} color scheme, bold typography for the event name, and a layout optimized for both print (A5) and social sharing (1:1). Make it impossible to miss.",
    fields: [
      { key: "event-name", label: "Event name", type: "text", required: true },
      { key: "event-type", label: "Event type", type: "text" },
      { key: "date", label: "Date", type: "text" },
      { key: "time", label: "Time", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "ticket-link", label: "Ticket link", type: "text", placeholder: "https://…" },
      { key: "color-scheme", label: "Color scheme", type: "text", placeholder: "e.g. neon on black" },
    ],
    views: 830,
  },
  {
    title: "Business Card Design",
    description:
      "A refined business card brief — front/back layout, finish options and clean hierarchy.",
    category: "Graphic Design",
    subcategory: "Print",
    tags: ["business card", "print", "branding", "stationery"],
    difficulty: "beginner",
    usefulFor:
      "Designing memorable business cards that match a personal or company brand.",
    requiredInputs: ["Name", "Job title", "Company", "Contact info", "Style", "Color palette"],
    template:
      "Design a business card for {{name}}, {{job-title}} at {{company}}. Include: {{contact-info}}. Use a {{style}} style with a {{color-palette}} palette. Standard 85\u00d755mm with safe margins, a strong front (name + role) and a clean back (contact details). Consider finish options (spot UV, letterpress, matte) and ensure the design stays elegant at a glance.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "job-title", label: "Job title", type: "text" },
      { key: "company", label: "Company", type: "text" },
      { key: "contact-info", label: "Contact info", type: "textarea", placeholder: "email, phone, website, socials" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. minimal Swiss" },
      { key: "color-palette", label: "Color palette", type: "text" },
    ],
    views: 720,
  },
  {
    title: "YouTube Thumbnail Concept",
    description:
      "A thumbnail brief that stays legible at tiny sizes — bold text, one focal subject, strong contrast.",
    category: "Graphic Design",
    subcategory: "Social graphics",
    tags: ["youtube", "thumbnail", "ctr", "content"],
    difficulty: "intermediate",
    usefulFor:
      "Designing high-click-through thumbnails for YouTube, shorts and video campaigns.",
    requiredInputs: ["Video topic", "Title text", "Mood", "Style", "Focal subject", "Color scheme"],
    template:
      "Design a YouTube thumbnail concept for a video about {{video-topic}}. The on-screen text should read \u201c{{title-text}}\u201d in large, legible type. The mood is {{mood}} and the style is {{style}}. Make {{focal-subject}} the visual anchor, use a {{color-scheme}} palette with strong contrast, and keep the composition readable at 1280\u00d7720 and at tiny sizes in subscription feeds. No more than 3 words of text.",
    fields: [
      { key: "video-topic", label: "Video topic", type: "text", required: true },
      { key: "title-text", label: "Title text", type: "text", placeholder: "max 3 words" },
      { key: "mood", label: "Mood", type: "text" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. bold reaction cutout" },
      { key: "focal-subject", label: "Focal subject", type: "text" },
      { key: "color-scheme", label: "Color scheme", type: "text" },
    ],
    views: 1110,
  },
  {
    title: "Book Cover Design",
    description:
      "A full book cover brief — front, spine, back, blurb placement and thumbnail presence.",
    category: "Graphic Design",
    subcategory: "Print",
    tags: ["book cover", "print", "publishing", "typography"],
    difficulty: "intermediate",
    usefulFor:
      "Designing book covers that stand out on shelves and stay striking at thumbnail size.",
    requiredInputs: ["Book title", "Author", "Genre", "Theme", "Style", "Format"],
    template:
      "Design a book cover for \u201c{{book-title}}\u201d by {{author}}, a {{genre}} novel. The central theme is {{theme}}. Create a {{style}} cover that stands out on a shelf and at thumbnail size. Deliver the {{format}} with full spine and back-cover treatment: author bio, blurb, barcode placement and a cohesive typographic system. No stock clich\u00e9s — the concept should feel original to the story.",
    fields: [
      { key: "book-title", label: "Book title", type: "text", required: true },
      { key: "author", label: "Author", type: "text" },
      { key: "genre", label: "Genre", type: "text" },
      { key: "theme", label: "Theme", type: "text", placeholder: "e.g. memory, loss, second chances" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. atmospheric, literary minimalism" },
      {
        key: "format",
        label: "Format",
        type: "select",
        options: ["print 6\u00d79\u2033", "print 5\u00d78\u2033", "ebook only", "series design"],
      },
    ],
    views: 640,
  },
  {
    title: "Restaurant Menu Design",
    description:
      "A menu brief that balances readability, hierarchy and seasonal flexibility.",
    category: "Graphic Design",
    subcategory: "Print",
    tags: ["menu", "restaurant", "print", "hospitality"],
    difficulty: "beginner",
    usefulFor:
      "Designing restaurant menus that are easy to read, easy to update and on-brand.",
    requiredInputs: ["Restaurant name", "Cuisine", "Style", "Color palette", "Sections", "Audience"],
    template:
      "Design a menu for {{restaurant-name}}, a {{cuisine}} restaurant. The visual style should be {{style}} with a {{color-palette}} palette. Organize the menu into these sections: {{sections}}. Design for a {{audience}} clientele — readable type sizes, clear pricing hierarchy, chef's recommendations highlighted, and an easy-to-update layout for seasonal changes. Provide print and digital versions.",
    fields: [
      { key: "restaurant-name", label: "Restaurant name", type: "text", required: true },
      { key: "cuisine", label: "Cuisine", type: "text" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. rustic, warm, hand-drawn" },
      { key: "color-palette", label: "Color palette", type: "text" },
      { key: "sections", label: "Sections", type: "textarea", placeholder: "one section per line" },
      { key: "audience", label: "Audience", type: "text" },
    ],
    views: 590,
  },
  {
    title: "Magazine Cover Design",
    description:
      "A cover design brief with masthead treatment, cover lines and thumbnail-proof layout.",
    category: "Graphic Design",
    subcategory: "Print",
    tags: ["magazine", "cover", "editorial", "typography"],
    difficulty: "professional",
    usefulFor:
      "Designing magazine and editorial covers that work in print and as small digital thumbnails.",
    requiredInputs: ["Magazine name", "Cover story", "Subject", "Style", "Color palette", "Format"],
    template:
      "Design a magazine cover for {{magazine-name}} featuring the cover story \u201c{{cover-story}}\u201d. Feature {{subject}} as the visual centerpiece. Use a {{style}} design language with a {{color-palette}} palette, a confident masthead treatment and cover lines that tease the issue without crowding the image. Deliver the {{format}} with proper bleed, and show how the cover scales to a 150px thumbnail.",
    fields: [
      { key: "magazine-name", label: "Magazine name", type: "text", required: true },
      { key: "cover-story", label: "Cover story", type: "text" },
      { key: "subject", label: "Subject", type: "text" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. Swiss grid, bold serif" },
      { key: "color-palette", label: "Color palette", type: "text" },
      { key: "format", label: "Format", type: "select", options: ["print cover", "digital cover", "both"] },
    ],
    views: 510,
  },
];
