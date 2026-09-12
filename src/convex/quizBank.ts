/**
 * Course-specific question bank for the seeded catalog.
 *
 * The generic "Review question N of 10" fillers that used to pad seeded
 * quizzes and final exams are replaced by these hand-authored questions,
 * written against each course's actual lesson material (titles, notes and
 * transcripts). The seed appends them to whatever the course already ships,
 * so every seeded quiz reaches 10 questions and every final exam reaches 30
 * with content a learner can only answer by studying the course.
 *
 * Keyed by course slug. `QUIZ_ADDITIONS[slug][i]` tops up quiz `i` (courses
 * in the seed have a single checkpoint quiz; the AI catalog ships three).
 * `EXAM_ADDITIONS[slug]` is used to build the 30-question final exam.
 */
import type { Question } from "./schema";
// Note: QUIZ_ADDITIONS and EXAM_ADDITIONS below are assembled from batches.

/** Multiple-choice helper — 2 points, like the seeded checkpoints. */
export const mc = (
  question: string,
  options: string[],
  answer: string,
  explanation?: string,
): Question => ({
  type: "multiple-choice",
  question,
  options,
  answer,
  points: 2,
  explanation,
});

/** True/false helper — 1 point. */
export const tf = (
  question: string,
  answer: "True" | "False",
  explanation?: string,
): Question => ({
  type: "true-false",
  question,
  options: ["True", "False"],
  answer,
  points: 1,
  explanation,
});

/** Short-answer helper with an auto-gradable key (quizzes only). */
export const sa = (
  question: string,
  answer: string,
  acceptedAnswers: string[],
  explanation?: string,
): Question => ({
  type: "short-answer",
  question,
  answer,
  acceptedAnswers,
  points: 3,
  explanation,
});

const QUIZ_BATCHES: Array<Record<string, Question[][]>> = [];
const EXAM_BATCHES: Array<Record<string, Question[]>> = [];
QUIZ_BATCHES.push({
  // ── Design roadmap ──────────────────────────────────────────────
  "design-fundamentals": [
    [
      mc("Which of these is a principle of design rather than an element?", ["Balance", "Line", "Shape", "Texture"], "Balance", "Line, shape and texture are elements; balance is a principle applied to them."),
      mc("In typography, what is leading?", ["The vertical space between lines of text", "The space between letters", "The height of capital letters", "The thickness of a stroke"], "The vertical space between lines of text"),
      mc("What does the rule of thirds suggest?", ["Place key elements along the grid lines or intersections", "Use only three colors", "Limit a design to three fonts", "Split the layout into three columns"], "Place key elements along the grid lines or intersections"),
      mc("Which color harmony uses three colors evenly spaced around the wheel?", ["Analogous", "Triadic", "Complementary", "Monochromatic"], "Triadic"),
      mc("Which exercise is the capstone of this course?", ["Designing a one-page brand identity system", "Writing a blog post", "Building a database", "Editing a video"], "Designing a one-page brand identity system"),
      tf("Whitespace is wasted space that should always be filled.", "False", "Whitespace gives content room to breathe and improves focus."),
      sa("Why should a designer check color contrast?", "To keep text readable for everyone, including people with low vision", ["accessibility", "readability", "contrast"]),
    ],
  ],
  "branding-essentials": [
    [
      mc("Which part of branding comes from strategy rather than style?", ["Brand positioning", "Font choice", "Icon style", "Color swatch"], "Brand positioning"),
      mc("What is a moodboard used for?", ["Exploring visual direction before designing", "Printing final files", "Testing code", "Sending invoices"], "Exploring visual direction before designing"),
      mc("What should a set of brand guidelines document?", ["Logo usage, colors, typography and voice rules", "Only the logo file", "The company's tax number", "Employee salaries"], "Logo usage, colors, typography and voice rules"),
      mc("How many refined logo concepts should a designer typically present?", ["About three", "About fifty", "Exactly one", "As many as possible"], "About three"),
      tf("A positioning statement defines who the brand is for and what makes it different.", "True"),
      tf("Consistency is what makes a brand feel premium over time.", "True"),
      sa("Name one situation a logo must still work in.", "When it is shown small or in a single color", ["small", "black and white", "one color", "scalability", "favicon"]),
    ],
  ],
  "ui-design-mastery": [
    [
      mc("What is a design system?", ["A reusable set of components, tokens and rules", "A single finished screen", "A typeface", "A user survey"], "A reusable set of components, tokens and rules"),
      mc("What is the goal of information architecture?", ["Organizing content so users can find things", "Choosing colors", "Writing marketing copy", "Selecting stock images"], "Organizing content so users can find things"),
      mc("Why start with low-fidelity wireframes?", ["To test structure quickly before investing in visual polish", "To deliver final files", "To market the product", "To prepare for print"], "To test structure quickly before investing in visual polish"),
      mc("What does card sorting help you understand?", ["How users group and label content", "How to pick colors", "How to grade a design", "How to write code"], "How users group and label content"),
      mc("What does a clickable prototype let you test?", ["The flow and usability before development", "Server performance", "SEO rankings", "File size"], "The flow and usability before development"),
      tf("A component should define states such as hover, focus and disabled.", "True"),
      tf("A shared component library improves consistency and speeds up design.", "True"),
    ],
  ],
  "portfolio-career-launchpad": [
    [
      mc("Roughly how long should a hiring manager need to understand a case study?", ["About 30 seconds", "30 minutes", "3 hours", "3 days"], "About 30 seconds"),
      mc("How many projects should usually anchor a portfolio?", ["Three strong ones", "Ten shallow ones", "Only one", "As many as possible"], "Three strong ones"),
      mc("What belongs in the first section of a case study?", ["The problem and your role", "Your favorite fonts", "Your biography", "Client invoices"], "The problem and your role"),
      mc("What is the STAR method used for?", ["Answering interview questions with a clear structure", "Designing logos", "Editing video", "Writing SQL"], "Answering interview questions with a clear structure"),
      tf("You should tailor your resume to each role you apply for.", "True"),
      tf("A resume is stronger when it lists measurable outcomes.", "True"),
      sa("Name one thing to research before a job interview.", "The company and the role", ["the company", "the role", "the interviewer", "the team"]),
    ],
  ],
  "professional-graphic-design": [
    [
      mc("What does a design brief capture?", ["The problem, audience, deliverables and constraints", "Only the budget", "Only the colors", "The final file"], "The problem, audience, deliverables and constraints"),
      mc("What is bleed in print design?", ["Extra artwork extending past the trim edge", "A drop shadow", "An increase in resolution", "File compression"], "Extra artwork extending past the trim edge"),
      mc("Why build a social media template system?", ["Consistency and speed across many posts", "To reduce file size", "To avoid branding", "To skip design"], "Consistency and speed across many posts"),
      mc("Why do professional designers present multiple variations?", ["To give clients options to react to", "To waste time", "To increase cost", "To hide mistakes"], "To give clients options to react to"),
      mc("Which delivery format is usually requested for professional print work?", ["Print-ready PDF", "GIF", "MP4", "CSV"], "Print-ready PDF"),
      tf("Presenting work means walking the client through your design decisions.", "True"),
      sa("Name one section you would include in a brand guidelines document.", "Logo usage", ["logo", "colors", "typography", "type", "voice"]),
    ],
  ],
});
QUIZ_BATCHES.push({
  // ── Photoshop & video editing ───────────────────────────────────
  "photoshop-mastery": [
    [
      mc("Where does a newly created layer sit in the stack?", ["Above the currently selected layer", "It replaces the background", "It merges automatically", "It deletes the layer below"], "Above the currently selected layer"),
      mc("What does the Quick Selection tool help you do?", ["Select similar areas quickly", "Add text", "Change the resolution", "Record actions"], "Select similar areas quickly"),
      mc("What is the key difference between masking and erasing?", ["Masking is non-destructive; erasing is permanent", "They are identical", "Erasing is always reversible", "Masking deletes the pixels"], "Masking is non-destructive; erasing is permanent"),
      mc("Which adjustment layer gives precise brightness and contrast control with a curve?", ["Curves", "Hue/Saturation", "Color Balance", "Photo Filter"], "Curves"),
      mc("What is the Healing Brush best for?", ["Removing small blemishes and spots", "Adding text", "Resizing the canvas", "Changing color mode"], "Removing small blemishes and spots"),
      tf("Smart objects let you resize and re-edit without losing quality.", "True"),
      sa("Why keep an editable master file of your edits?", "So the work can be revised later without starting over", ["revisions", "non-destructive", "future edits", "changes"]),
    ],
  ],
  "video-editing-with-capcut": [
    [
      mc("What does a cut remove?", ["Part of a clip to tighten pacing", "The audio track", "The resolution", "A text layer"], "Part of a clip to tighten pacing"),
      mc("What is a jump cut?", ["A cut between two similar shots in the same scene", "A fade to black", "A title card", "A sound effect"], "A cut between two similar shots in the same scene"),
      mc("Why sync cuts to the music?", ["It gives the edit rhythm and energy", "It reduces file size", "It changes the frame rate", "It adds captions automatically"], "It gives the edit rhythm and energy"),
      mc("What is a transition?", ["A visual bridge between two clips", "A type of music", "A caption style", "An export setting"], "A visual bridge between two clips"),
      mc("What is the purpose of a title card?", ["To introduce the video or a section", "To raise the volume", "To change the aspect ratio", "To compress the file"], "To introduce the video or a section"),
      tf("Vertical 9:16 video suits Reels and TikTok better than 16:9.", "True"),
      sa("Name one thing to remove while editing to improve pace.", "Dead air", ["dead air", "silence", "filler", "repetition", "pauses"]),
    ],
  ],
  "capcut-pro-editing": [
    [
      mc("What is a speed ramp?", ["A gradual change in clip speed", "A file format", "A caption style", "A type of music"], "A gradual change in clip speed"),
      mc("What does color grading control?", ["The look and mood of the footage", "The export resolution", "The file name", "The bitrate"], "The look and mood of the footage"),
      mc("Why duck music under a voiceover?", ["So the dialogue stays clear", "To add echo", "To raise the pitch", "To remove captions"], "So the dialogue stays clear"),
      mc("What is multi-clip storytelling?", ["Cutting between multiple clips to build a narrative", "Using one long take", "Adding a single title", "Exporting many files"], "Cutting between multiple clips to build a narrative"),
      mc("Why keep a master export of every project?", ["You can re-export for other platforms later", "It loads faster", "It is always smaller", "It adds effects"], "You can re-export for other platforms later"),
      tf("Captions help viewers follow a video when they watch on mute.", "True"),
      sa("Name one export setting you match to a platform.", "Aspect ratio", ["aspect ratio", "resolution", "frame rate", "bitrate"]),
    ],
  ],
  "capcut-pro-storytelling": [
    [
      mc("What should the first three seconds of a video do?", ["Hook the viewer", "Show full credits", "Explain pricing", "List the tools used"], "Hook the viewer"),
      mc("What does matching color across clips prevent?", ["Distracting jumps between shots", "Slow exports", "Small file sizes", "Loud audio"], "Distracting jumps between shots"),
      mc("What is a LUT?", ["A preset that maps colors to create a look", "A caption style", "A file format", "A microphone setting"], "A preset that maps colors to create a look"),
      mc("What is the professional way to handle client feedback?", ["Organize the notes and make targeted revisions", "Ignore it", "Start over every time", "Argue about taste"], "Organize the notes and make targeted revisions"),
      mc("Why is a brand content system valuable?", ["Reusable templates keep every post consistent", "It replaces editing", "It removes the need for music", "It lowers quality"], "Reusable templates keep every post consistent"),
      tf("Logging and organizing raw footage speeds up editing.", "True"),
      sa("Name one deliverable in a professional edit handoff.", "The final export", ["final export", "master file", "project file", "captions", "thumbnail"]),
    ],
  ],
  "photoshop-pro-workflows": [
    [
      mc("What are the two layers created by frequency separation?", ["Texture and color/tone", "Foreground and background", "RGB and CMYK", "Vector and raster"], "Texture and color/tone"),
      mc("What must match for a convincing composite?", ["Light direction, color and perspective", "File names", "Layer colors", "Brush sizes"], "Light direction, color and perspective"),
      mc("What is the benefit of batch processing?", ["Applying the same steps to many files automatically", "Sharper images", "Smaller files", "Better color"], "Applying the same steps to many files automatically"),
      mc("Why name and organize files consistently?", ["It makes handoff and revisions easier", "It improves image quality", "It increases resolution", "It adds effects"], "It makes handoff and revisions easier"),
      mc("What does a Photoshop action record?", ["A sequence of steps you can replay", "A single color", "A file format", "A type of layer"], "A sequence of steps you can replay"),
      tf("Print files should be prepared in CMYK with bleed and safe margins.", "True"),
      sa("Name one requirement for a print-ready delivery file.", "Bleed", ["bleed", "cmyk", "safe margin", "resolution", "300 dpi"]),
    ],
  ],
});
QUIZ_BATCHES.push({
  // ── Development roadmap ─────────────────────────────────────────
  "html-css-the-modern-web": [
    [
      mc("Which tag groups a page's navigation links?", ["<nav>", "<main>", "<footer>", "<section>"], "<nav>"),
      mc("What does the CSS box model consist of?", ["Content, padding, border and margin", "Only the content", "Colors and fonts", "Grid and flex"], "Content, padding, border and margin"),
      mc("What does mobile-first design mean?", ["Designing for the smallest screen first, then enhancing", "Building a native mobile app", "Ignoring desktop users", "Using only rem units"], "Designing for the smallest screen first, then enhancing"),
      mc("Which tool is best for a one-dimensional row of items?", ["Flexbox", "CSS Grid", "Float", "Tables"], "Flexbox"),
      mc("What is a media query used for?", ["Applying different styles at different viewport sizes", "Changing the HTML structure", "Uploading images", "Deploying the site"], "Applying different styles at different viewport sizes"),
      tf("Semantic HTML improves both accessibility and SEO.", "True"),
      sa("Name the attribute that describes an image for screen readers.", "alt", ["alt", "alt text"]),
    ],
  ],
  "javascript-deep-dive": [
    [
      mc("What is a closure?", ["A function that remembers variables from where it was created", "A CSS rule", "A type of array", "A network request"], "A function that remembers variables from where it was created"),
      mc("What does Array.filter() return?", ["A new array of the items that pass a test", "A single value", "A promise", "A string"], "A new array of the items that pass a test"),
      mc("Which array method transforms every item into a new array?", ["map", "forEach", "push", "pop"], "map"),
      mc("What does an event listener do?", ["Runs code in response to an event", "Styles an element", "Fetches a file automatically", "Declares a variable"], "Runs code in response to an event"),
      mc("What is a Promise?", ["An object representing a future value", "A type of loop", "A function that runs immediately", "A CSS selector"], "An object representing a future value"),
      tf("const prevents reassignment but does not make an object immutable.", "True"),
      sa("What does async/await make more readable?", "Asynchronous code", ["asynchronous code", "promises", "async code"]),
    ],
  ],
  "backend-apis-with-node": [
    [
      mc("Which HTTP method is typically used to create a new resource?", ["POST", "GET", "DELETE", "HEAD"], "POST"),
      mc("What is middleware?", ["Code that runs between the request and the route handler", "A database", "A frontend framework", "A type of route"], "Code that runs between the request and the route handler"),
      mc("What does idempotency mean in REST?", ["Repeating the same request produces the same result", "Every request changes data", "A caching strategy", "A status code"], "Repeating the same request produces the same result"),
      mc("What is input validation for?", ["Rejecting bad data before it causes errors", "Speeding up queries", "Improving design", "Adding logs"], "Rejecting bad data before it causes errors"),
      mc("Which status code means the request succeeded?", ["200", "404", "500", "301"], "200"),
      tf("Environment variables keep secrets out of your source code.", "True"),
      sa("Name a technique used to store passwords safely.", "Hashing", ["hashing", "bcrypt", "salt", "hash"]),
    ],
  ],
  "full-stack-project-build-an-lms": [
    [
      mc("What should be defined before designing the data model?", ["Requirements and features", "The logo", "The color palette", "The marketing plan"], "Requirements and features"),
      mc("What is the relationship between a user and a course they join called?", ["Enrollment", "Invoice", "Deployment", "Session"], "Enrollment"),
      mc("Why enforce authorization on the server?", ["Clients can be bypassed, so the server is the source of truth", "To make the UI pretty", "To reduce file size", "To cache data"], "Clients can be bypassed, so the server is the source of truth"),
      mc("What is the purpose of a QA pass before launch?", ["Finding and fixing edge cases", "Adding new features", "Writing marketing copy", "Designing logos"], "Finding and fixing edge cases"),
      mc("What belongs in a short architecture walkthrough?", ["How data flows between UI, API and database", "Your hobbies", "The price list", "Random clips"], "How data flows between UI, API and database"),
      tf("A migration changes the database structure in a controlled way.", "True"),
      sa("Name one thing to verify before deploying an app.", "Environment variables", ["environment variables", "env vars", "tests", "build", "auth", "secrets"]),
    ],
  ],
  "data-analytics-foundations": [
    [
      mc("What is a KPI?", ["A metric tied to a goal", "A chart type", "A spreadsheet", "A database"], "A metric tied to a goal"),
      mc("What does analytical thinking look like?", ["Turning a vague question into a measurable one", "Guessing an answer", "Copying a chart", "Ignoring outliers"], "Turning a vague question into a measurable one"),
      mc("What does data hygiene involve?", ["Deduplicating, validating and documenting data", "Only visualizing data", "Buying new tools", "Deleting data"], "Deduplicating, validating and documenting data"),
      mc("Which function looks up a value from another table?", ["VLOOKUP or XLOOKUP", "CONCAT", "TODAY", "ROUND"], "VLOOKUP or XLOOKUP"),
      mc("What makes an analysis presentation land?", ["A clear narrative with the key insight first", "Listing every number you found", "Using lots of jargon", "Ending with no conclusion"], "A clear narrative with the key insight first"),
      tf("Correlation always proves causation.", "False", "Correlation can suggest a relationship, but it does not prove cause."),
      sa("Name one step of cleaning a dataset.", "Removing duplicates", ["removing duplicates", "dedupe", "deduplication", "fixing missing values", "handling nulls"]),
    ],
  ],
});
QUIZ_BATCHES.push({
  // ── Data, marketing & business ──────────────────────────────────
  "sql-data-wrangling": [
    [
      mc("Which clause sorts the result rows?", ["ORDER BY", "WHERE", "GROUP BY", "SELECT"], "ORDER BY"),
      mc("What does COUNT(*) return?", ["The number of rows", "The sum of a column", "The average of a column", "The first row"], "The number of rows"),
      mc("What is a window function?", ["A calculation across a set of rows that does not collapse them", "A popup in the UI", "A type of join", "A stored procedure only"], "A calculation across a set of rows that does not collapse them"),
      mc("Which is best for a reusable, readable complex query?", ["Common Table Expressions (CTEs)", "Nested SELECTs everywhere", "No comments", "SELECT *"], "Common Table Expressions (CTEs)"),
      mc("What does COALESCE do?", ["Returns the first non-null value", "Deletes nulls", "Duplicates rows", "Sorts alphabetically"], "Returns the first non-null value"),
      tf("WHERE filters rows before aggregation; HAVING filters groups after it.", "True"),
      sa("Name one SQL function used to handle dirty data.", "COALESCE", ["coalesce", "case", "trim", "cast", "nullif"]),
    ],
  ],
  "machine-learning-essentials": [
    [
      mc("What is a feature?", ["An input variable used by the model", "A type of label", "A plot", "A library"], "An input variable used by the model"),
      mc("What does a confusion matrix show?", ["True/false positives and negatives", "Feature importance", "The learning rate", "The dataset size"], "True/false positives and negatives"),
      mc("What is regression used for?", ["Predicting a numeric value", "Predicting a category", "Only classifying images", "Cleaning data"], "Predicting a numeric value"),
      mc("What is regularization for?", ["Reducing overfitting", "Increasing speed", "Cleaning data", "Adding features"], "Reducing overfitting"),
      mc("Which library is used for classical ML models in this course?", ["scikit-learn", "React", "Express", "Figma"], "scikit-learn"),
      tf("Cross-validation gives a more reliable estimate than a single train/test split.", "True"),
      sa("Why is a baseline model useful?", "It gives a benchmark to compare your model against", ["comparison", "benchmark", "baseline"]),
    ],
  ],
  "marketing-fundamentals": [
    [
      mc("What is a persona?", ["A profile of a target audience segment", "A brand color", "A marketing channel", "A budget"], "A profile of a target audience segment"),
      mc("Which are the classic funnel stages?", ["Awareness, consideration and conversion", "Awareness only", "Clicks and likes", "Design and delivery"], "Awareness, consideration and conversion"),
      mc("What does positioning define?", ["How the product is different in the customer's mind", "The ad budget", "The logo size", "The warehouse location"], "How the product is different in the customer's mind"),
      mc("What makes content shareable?", ["A story with a strong hook and clear value", "Heavy jargon", "Long paragraphs", "Hidden value"], "A story with a strong hook and clear value"),
      mc("Which comes first, messaging or channel selection?", ["Messaging", "Channel selection", "They are unrelated", "Neither matters"], "Messaging"),
      tf("Different channels play different roles in the funnel.", "True"),
      sa("Complete the core idea of a positioning statement template.", "For [audience], [product] is the [category] that [benefit]", ["for audience", "audience", "benefit", "category"]),
    ],
  ],
  "growth-performance-marketing": [
    [
      mc("What does CAC stand for?", ["Customer acquisition cost", "Click analytics counter", "Conversion attribution code", "Campaign average cost"], "Customer acquisition cost"),
      mc("What is a growth loop?", ["A system where output feeds new input for compounding growth", "A one-off campaign", "A single ad", "A landing page"], "A system where output feeds new input for compounding growth"),
      mc("What does a valid A/B test need?", ["A hypothesis plus enough sample size and duration", "Many changes at once", "No control group", "Instant results"], "A hypothesis plus enough sample size and duration"),
      mc("What is attribution?", ["Assigning credit for a conversion to the right touchpoints", "Running an A/B test", "Writing copy", "Setting a budget"], "Assigning credit for a conversion to the right touchpoints"),
      mc("What should a landing page have?", ["One clear call to action and clear proof", "Many competing CTAs", "No headline", "Only images"], "One clear call to action and clear proof"),
      tf("Changing many variables at once makes A/B test results hard to interpret.", "True"),
      sa("Name one metric used to measure ad efficiency.", "CPA", ["cpa", "cac", "roas", "cost per acquisition"]),
    ],
  ],
  "entrepreneurship-lean-startups": [
    [
      mc("What is the riskiest assumption?", ["The belief that, if wrong, breaks the business", "A color choice", "A pricing detail", "A logo decision"], "The belief that, if wrong, breaks the business"),
      mc("What should customer discovery interviews focus on?", ["Past behavior and real problems", "Hypotheticals", "Your feature list", "Investors"], "Past behavior and real problems"),
      mc("What is product-market fit?", ["When the market pulls the product", "When the product is finished", "When funding closes", "When the logo is chosen"], "When the market pulls the product"),
      mc("What is unit economics?", ["Revenue and cost per customer or unit", "The total staff count", "The office rent", "The brand colors"], "Revenue and cost per customer or unit"),
      mc("What does an MVP test?", ["Your riskiest assumption", "Your full feature set", "Your legal structure", "Your logo"], "Your riskiest assumption"),
      tf("Pricing is a strategic decision, not just a number.", "True"),
      sa("Name one sign of a painful, frequent problem worth solving.", "People already pay to solve it", ["willingness to pay", "people already pay", "workaround", "urgent", "frequent"]),
    ],
  ],
});
QUIZ_BATCHES.push({
  // ── AI & modern-work catalog (three level checkpoints each) ─────
  "build-websites-with-ai": [
    // Beginner
    [
      mc("What does a domain name do?", ["Gives your site an address people can type", "Hosts the files", "Designs the pages", "Writes the code"], "Gives your site an address people can type"),
      mc("What is the difference between hosting and deployment?", ["Hosting stores and serves the site; deployment publishes it", "They are identical", "Hosting is design; deployment is coding", "Hosting is free; deployment is paid"], "Hosting stores and serves the site; deployment publishes it"),
      mc("What is a good first step before generating a website with AI?", ["Write a brief with goal, audience, pages and content", "Buy ads", "Pick fonts at random", "Record a video"], "Write a brief with goal, audience, pages and content"),
      mc("Why does the brief matter when prompting?", ["It gives the AI the audience, tone and structure to follow", "It reduces hosting cost", "It changes the domain", "It adds SEO automatically"], "It gives the AI the audience, tone and structure to follow"),
      tf("AI website builders are fastest for simple sites, while AI coding assistants offer more control.", "True"),
      mc("What should a UI/UX-aware AI site prioritize?", ["Clear hierarchy, readable type and obvious navigation", "As many colors as possible", "Autoplay video everywhere", "Tiny text"], "Clear hierarchy, readable type and obvious navigation"),
    ],
    // Intermediate
    [
      mc("In generated code, what is CSS responsible for?", ["Styling and layout", "Data storage", "Server logic", "DNS"], "Styling and layout"),
      mc("What does mobile-first mean?", ["Designing for the smallest screen first, then enhancing", "Building a native mobile app", "Ignoring desktop users", "Using only images"], "Designing for the smallest screen first, then enhancing"),
      mc("What does a form still need to actually collect data?", ["A backend or service to receive and store it", "Nothing", "Only CSS", "A logo"], "A backend or service to receive and store it"),
      mc("Which HTML element groups navigation links?", ["<nav>", "<footer>", "<main>", "<article>"], "<nav>"),
      mc("Why refactor AI-generated code?", ["To improve readability and maintainability", "To make it longer", "To remove all styling", "To add random effects"], "To improve readability and maintainability"),
      tf("Debugging AI-generated code usually starts by reading the error and reproducing it.", "True"),
    ],
    // Professional
    [
      mc("Which change improves both accessibility and SEO?", ["Adding descriptive alt text to images", "Adding more animations", "Using bigger files", "Hiding text in the background"], "Adding descriptive alt text to images"),
      mc("Which is a security red flag in AI-generated code?", ["Hardcoded API keys and secrets", "Semantic HTML", "Alt text", "Responsive CSS"], "Hardcoded API keys and secrets"),
      mc("What do Core Web Vitals measure?", ["Real-world performance and user experience", "The number of pages", "The domain price", "The logo quality"], "Real-world performance and user experience"),
      mc("What does deployment mean?", ["Publishing the site so it has a live URL", "Writing the content", "Designing in Figma", "Buying a domain"], "Publishing the site so it has a live URL"),
      mc("What is the best way to maintain a site after launch?", ["Version control and controlled updates", "Retype everything from scratch", "Delete it weekly", "Never update it"], "Version control and controlled updates"),
      tf("You should validate inputs and keep secrets out of the client bundle before publishing AI code.", "True"),
    ],
  ],
  "data-analysis-with-excel": [
    // Beginner
    [
      mc("What is the first stage of the data analysis process?", ["Understand the business question", "Build a pivot table", "Format the cells", "Create a chart"], "Understand the business question"),
      mc("Which Excel feature removes duplicate rows?", ["Remove Duplicates", "Freeze Panes", "Conditional Formatting", "Data Validation"], "Remove Duplicates"),
      mc("Why explore a dataset before analyzing it?", ["To understand its structure, quality and outliers", "To color it", "To rename it", "To print it"], "To understand its structure, quality and outliers"),
      mc("What does sorting do?", ["Orders rows by a column's values", "Deletes rows", "Sums values", "Changes formats"], "Orders rows by a column's values"),
      tf("Missing data should be understood and handled deliberately, not ignored.", "True"),
      mc("What is a sensible first check on a new dataset?", ["Look at its size, columns and data types", "Start formatting", "Make a logo", "Rename every column"], "Look at its size, columns and data types"),
    ],
    // Intermediate
    [
      mc("What does the IF function do?", ["Returns one value if a condition is true and another if false", "Sums a range", "Looks up a value", "Sorts data"], "Returns one value if a condition is true and another if false"),
      mc("What does XLOOKUP do?", ["Finds a value in a range and returns a related value", "Counts rows", "Formats cells", "Creates charts"], "Finds a value in a range and returns a related value"),
      mc("What is a pivot table for?", ["Summarizing data by grouping it into categories", "Storing macros", "Formatting fonts", "Encrypting files"], "Summarizing data by grouping it into categories"),
      mc("Which function sums values that meet one condition?", ["SUMIF", "CONCAT", "TODAY", "LEN"], "SUMIF"),
      mc("What does conditional formatting do?", ["Changes a cell's appearance based on its value", "Edits formulas", "Sorts tables", "Removes duplicates"], "Changes a cell's appearance based on its value"),
      tf("Data validation restricts what users can enter into a cell.", "True"),
    ],
    // Professional
    [
      mc("What is Power Query mainly used for?", ["Repeatable data cleaning and loading", "Designing logos", "Writing emails", "Encrypting files"], "Repeatable data cleaning and loading"),
      mc("What makes a dashboard effective?", ["A clear story with the key metrics up front", "Every possible chart", "Random colors", "Hidden numbers"], "A clear story with the key metrics up front"),
      mc("What does a trend line help you see?", ["The direction of change over time", "The file size", "The color scheme", "The number of sheets"], "The direction of change over time"),
      mc("What is a KPI?", ["A metric tied to a business goal", "A chart style", "A formula error", "A cell format"], "A metric tied to a business goal"),
      mc("What does connecting Power BI to a dataset let you do?", ["Build interactive, refreshable reports", "Only edit the raw CSV", "Replace Excel entirely", "Host your website"], "Build interactive, refreshable reports"),
      tf("Documenting an analysis makes it easier to trust and reproduce.", "True"),
    ],
  ],
});
QUIZ_BATCHES.push({
  "ai-video-generation-content-creation": [
    // Beginner
    [
      mc("What is text-to-video?", ["Generating video from a written prompt", "Editing footage by hand", "Uploading a clip", "Adding captions"], "Generating video from a written prompt"),
      mc("What should a video prompt describe?", ["Subject, action, style, camera and mood", "Only the title", "The file size", "Only the music"], "Subject, action, style, camera and mood"),
      mc("Why storyboard before generating?", ["To plan scenes and consistency before spending credits", "To add music", "To export faster", "To upload files"], "To plan scenes and consistency before spending credits"),
      mc("What is image-to-video?", ["Animating a still image into a clip", "Editing a photo", "Exporting a still", "Adding captions"], "Animating a still image into a clip"),
      tf("AI video platforms vary in quality, cost, rights and the control they give you.", "True"),
      mc("What is a good use of AI script writing?", ["Drafting structure and hooks for you to refine", "Skipping planning entirely", "Replacing editing", "Adding captions"], "Drafting structure and hooks for you to refine"),
    ],
    // Intermediate
    [
      mc("What is an AI voiceover used for?", ["Narration without recording a human voice", "Editing footage", "Coloring clips", "Writing captions"], "Narration without recording a human voice"),
      mc("What does an AI avatar or presenter do?", ["Delivers scripted lines as a synthetic person", "Edits video", "Creates music", "Hosts files"], "Delivers scripted lines as a synthetic person"),
      mc("Why add sound effects?", ["To sell the action and add polish", "To change resolution", "To add captions", "To increase file size"], "To sell the action and add polish"),
      mc("What makes a social video effective?", ["A strong hook and clear message in the first seconds", "A long intro", "No captions", "A single static frame"], "A strong hook and clear message in the first seconds"),
      mc("What should an AI advertisement start from?", ["A clear brief and target audience", "Random clips", "A finished edit", "A logo only"], "A clear brief and target audience"),
      tf("Music and sound effects should support the story, not overwhelm it.", "True"),
    ],
    // Professional
    [
      mc("How do you keep characters and style consistent across AI scenes?", ["Reuse character and style references across prompts", "Change the style every scene", "Use random settings", "Avoid prompts"], "Reuse character and style references across prompts"),
      mc("Why are captions important for social video?", ["Most viewers watch on mute", "They change resolution", "They add music", "They improve AI quality"], "Most viewers watch on mute"),
      mc("What should you check about AI-generated content before publishing?", ["Copyright, licensing and disclosure requirements", "Only the file size", "Only the thumbnail", "Nothing"], "Copyright, licensing and disclosure requirements"),
      mc("What is a client-style promo campaign built around?", ["One strong idea adapted across formats", "Random clips", "A single platform only", "No brief"], "One strong idea adapted across formats"),
      mc("What is the final step before delivery?", ["Review the export for quality and brand consistency", "Generate more clips", "Buy more credits", "Skip captions"], "Review the export for quality and brand consistency"),
      tf("Each platform (YouTube, TikTok, Reels) prefers its own aspect ratio and length.", "True"),
    ],
  ],
  "ai-automation-productivity": [
    // Beginner
    [
      mc("What is a trigger in an automation?", ["The event that starts the workflow", "The final step", "A filter", "The output"], "The event that starts the workflow"),
      mc("What is a good candidate for automation?", ["A repetitive, rule-based manual task", "A one-off creative decision", "A strategy meeting", "A negotiation"], "A repetitive, rule-based manual task"),
      mc("What are the three parts of a workflow design?", ["Trigger, steps and outcome", "Colors, fonts and images", "Hosting, DNS and SSL", "Input, output and error"], "Trigger, steps and outcome"),
      mc("What is the first step in automating a task?", ["Audit and map how the task works today", "Buy tools", "Delete data", "Hire staff"], "Audit and map how the task works today"),
      tf("No-code tools let non-developers build automations with visual steps.", "True"),
      mc("Why choose a tool by fit rather than hype?", ["The right tool matches the workflow's needs", "All tools are identical", "Cost never matters", "Tools cannot integrate"], "The right tool matches the workflow's needs"),
    ],
    // Intermediate
    [
      mc("What is an AI assistant or agent inside a workflow?", ["A step that uses AI to decide or generate content", "A database", "A trigger", "A logo"], "A step that uses AI to decide or generate content"),
      mc("What is a common email automation?", ["Sending a welcome or follow-up sequence automatically", "Writing every email by hand", "Printing emails", "Deleting emails"], "Sending a welcome or follow-up sequence automatically"),
      mc("What does a form-to-database automation do?", ["Captures submissions and stores them without manual entry", "Deletes the form", "Emails the form", "Prints submissions"], "Captures submissions and stores them without manual entry"),
      mc("What does social-media automation help with?", ["Scheduling and distributing content consistently", "Editing videos", "Designing logos", "Writing code"], "Scheduling and distributing content consistently"),
      mc("When building a business-task automation, what should you test first?", ["The happy path with sample data", "Random inputs in production", "Nothing", "The marketing copy"], "The happy path with sample data"),
      tf("Document processing with AI can extract data from invoices and PDFs.", "True"),
    ],
    // Professional
    [
      mc("What is a webhook?", ["An automatic message sent when an event happens", "A spreadsheet", "A type of database", "A login method"], "An automatic message sent when an event happens"),
      mc("Why add error handling to an automation?", ["So failures are caught instead of silently breaking", "To slow it down", "To add cost", "To remove steps"], "So failures are caught instead of silently breaking"),
      mc("What does monitoring an automation tell you?", ["Whether it ran, whether it succeeded and how often", "The logo", "The font", "The domain price"], "Whether it ran, whether it succeeded and how often"),
      mc("Why document an automation SOP-style?", ["So others can maintain and troubleshoot it", "To add more steps", "To slow it down", "To hide it"], "So others can maintain and troubleshoot it"),
      mc("What should a customer-support automation escalate?", ["Edge cases that need a human", "Every message", "Nothing", "Only greetings"], "Edge cases that need a human"),
      tf("Automations should follow the principle of least privilege when accessing data.", "True"),
    ],
  ],
});
QUIZ_BATCHES.push({
  "prompt-engineering": [
    // Beginner
    [
      mc("What is prompt engineering?", ["Designing inputs that get reliable, useful AI outputs", "Writing code", "Training a model from scratch", "Designing logos"], "Designing inputs that get reliable, useful AI outputs"),
      mc("Which are the core parts of a strong prompt?", ["Context, task, constraints and output format", "Only the task", "Random words", "A single keyword"], "Context, task, constraints and output format"),
      mc("What is few-shot prompting?", ["Including a few examples of the desired output", "Asking for five answers", "Running five prompts", "Using five models"], "Including a few examples of the desired output"),
      mc("What does specifying an output format do?", ["Makes results consistent and easier to use", "Changes the model", "Only reduces cost", "Adds randomness"], "Makes results consistent and easier to use"),
      mc("What is a role in prompting?", ["A persona or perspective the model should take", "A database table", "A file type", "A type of prompt error"], "A persona or perspective the model should take"),
      tf("Clear instructions and constraints usually improve output quality.", "True"),
    ],
    // Intermediate
    [
      mc("What is iterative refinement?", ["Testing a prompt, observing the result, then improving it", "Writing once and stopping", "Randomizing prompts", "Deleting outputs"], "Testing a prompt, observing the result, then improving it"),
      mc("How do you reduce hallucinations?", ["Provide references and ask the model to verify", "Remove all context", "Ask for more confidence", "Use longer words"], "Provide references and ask the model to verify"),
      mc("What are structured outputs good for?", ["Consistent, machine-readable results such as JSON", "Longer prose", "More creativity", "Fewer constraints"], "Consistent, machine-readable results such as JSON"),
      mc("What helps when prompting for coding tasks?", ["Giving context, constraints and expected behavior", "Only saying 'fix it'", "No examples", "Random snippets"], "Giving context, constraints and expected behavior"),
      mc("What does a prompt template do?", ["Reuses a proven structure with variable slots", "Deletes prompts", "Trains the model", "Adds randomness"], "Reuses a proven structure with variable slots"),
      tf("System instructions can define reusable behavior for an assistant.", "True"),
    ],
    // Professional
    [
      mc("What should you include when prompting for data analysis?", ["The data context, the question and the desired output", "Only a chart request", "Random columns", "No goal"], "The data context, the question and the desired output"),
      mc("What matters when prompting for image or video generation?", ["Subject, style, composition and constraints", "Only the title", "The file size", "The captions"], "Subject, style, composition and constraints"),
      mc("Why adapt prompts across AI platforms?", ["Models differ, so instructions may need tuning", "All models are identical", "To increase cost", "To add randomness"], "Models differ, so instructions may need tuning"),
      mc("What is a professional prompt library for?", ["Storing, reusing and improving proven prompts", "Deleting prompts", "Training models", "Writing code"], "Storing, reusing and improving proven prompts"),
      mc("What is a good way to evaluate a prompt?", ["Compare outputs against clear, consistent criteria", "Guess", "Use the longest prompt", "Avoid testing"], "Compare outputs against clear, consistent criteria"),
      tf("Evaluating prompts with criteria and test inputs makes results more reliable.", "True"),
    ],
  ],
  "ai-productivity-digital-work": [
    // Beginner
    [
      mc("Why is AI now considered a professional baseline?", ["It speeds up everyday knowledge work", "It replaces all jobs", "It removes the need to learn", "It only writes code"], "It speeds up everyday knowledge work"),
      mc("What is a good use of AI for research?", ["Summarizing and suggesting sources that you then verify", "Trusting it blindly", "Skipping reading", "Replacing your judgment"], "Summarizing and suggesting sources that you then verify"),
      mc("What should you do with an AI summary of a long document?", ["Verify the key points against the source", "Publish it unchecked", "Ignore the source", "Delete it"], "Verify the key points against the source"),
      mc("What makes an AI-written email good?", ["Clear purpose, tone and a specific ask", "Random length", "Heavy jargon", "No subject line"], "Clear purpose, tone and a specific ask"),
      mc("How should you choose productivity tools?", ["By how well they fit your workflow", "By hype only", "By price alone", "At random"], "By how well they fit your workflow"),
      tf("AI note-takers can capture and summarize meeting action items.", "True"),
    ],
    // Intermediate
    [
      mc("How is AI useful when creating presentations?", ["Drafting structure and slide content for you to refine", "Replacing the message", "Removing visuals", "Writing code only"], "Drafting structure and slide content for you to refine"),
      mc("How can AI help with spreadsheets?", ["Explaining formulas and suggesting analysis", "Deleting your data", "Replacing Excel", "Hosting files"], "Explaining formulas and suggesting analysis"),
      mc("What is a good use of AI for projects?", ["Breaking goals into tasks and timelines", "Avoiding planning", "Replacing communication", "Random guesses"], "Breaking goals into tasks and timelines"),
      mc("How can AI support a job search?", ["Drafting and tailoring a resume and cover letter", "Guaranteeing a job", "Faking experience", "Skipping interviews"], "Drafting and tailoring a resume and cover letter"),
      mc("What should you verify in an AI-drafted freelance proposal?", ["Scope, price and promises you can deliver", "Only the font", "The file size", "Nothing"], "Scope, price and promises you can deliver"),
      tf("AI can help you learn faster by explaining concepts and creating practice.", "True"),
    ],
    // Professional
    [
      mc("What is a personal AI workflow?", ["A repeatable system of AI steps for your regular tasks", "A single prompt", "A social media account", "A database"], "A repeatable system of AI steps for your regular tasks"),
      mc("What does connecting productivity tools achieve?", ["Information flows between them automatically", "Fewer files", "Better colors", "Faster internet"], "Information flows between them automatically"),
      mc("What is the key responsibility when using AI at work?", ["Review and verify the output before you own it", "Trust it fully", "Skip checking", "Hide that you used it"], "Review and verify the output before you own it"),
      mc("What should you never put into a public AI tool?", ["Confidential or personal data you are not allowed to share", "Your own writing", "Public facts", "Your questions"], "Confidential or personal data you are not allowed to share"),
      mc("What makes a final AI productivity system valuable?", ["It saves real time on recurring work", "It uses the most tools", "It is complex", "It replaces your judgment"], "It saves real time on recurring work"),
      tf("Responsible AI use includes honesty, privacy and respecting others' data.", "True"),
    ],
  ],
});
// (quiz batches complete — see QUIZ_BATCHES.push above)

EXAM_BATCHES.push({
  // ── AI & modern-work catalog ────────────────────────────────────
  "build-websites-with-ai": [
    mc("What should you check before publishing AI-generated code?", ["Hardcoded secrets and input validation", "The footer color", "The number of images", "The domain price"], "Hardcoded secrets and input validation"),
    mc("What does alt text improve?", ["Accessibility and SEO", "File size", "Load time", "Security"], "Accessibility and SEO"),
    mc("Which CSS tool handles a two-dimensional layout?", ["CSS Grid", "Float", "Position absolute", "Tables"], "CSS Grid"),
    mc("Why plan a page structure before generating?", ["It organizes pages and content for the AI", "It picks the colors", "It hosts the site", "It buys ads"], "It organizes pages and content for the AI"),
    mc("Why is version control valuable for AI-assisted sites?", ["You can track changes and revert", "It makes sites faster", "It removes the need for tests", "It adds SEO"], "You can track changes and revert"),
    mc("What should a landing page have?", ["A clear headline, proof and one call to action", "Many competing CTAs", "No images", "Only animations"], "A clear headline, proof and one call to action"),
    mc("What does an API let a website do?", ["Fetch or send data to a service", "Style the page", "Host the domain", "Write copy"], "Fetch or send data to a service"),
    tf("A strong website prompt describes audience, tone and structure, not just the topic.", "True"),
    tf("Responsive design means the layout adapts to different screen sizes.", "True"),
    mc("What is a good evaluation step for AI-generated code?", ["Review quality, security and maintainability", "Trust it blindly", "Delete it", "Ship it without testing"], "Review quality, security and maintainability"),
  ],
  "data-analysis-with-excel": [
    mc("What does the term clean data mean?", ["Duplicates, errors and gaps have been handled", "The data is colorful", "The data is in many sheets", "The data is charted"], "Duplicates, errors and gaps have been handled"),
    mc("Which tool creates repeatable cleaning steps?", ["Power Query", "Font size", "Merge cells", "Freeze panes"], "Power Query"),
    mc("What is the best first step for any analysis?", ["Define the question", "Choose colors", "Print the sheet", "Hide columns"], "Define the question"),
    mc("Which function counts the cells meeting a condition?", ["COUNTIF", "SUM", "LOOKUP", "TRIM"], "COUNTIF"),
    mc("What should come first in a findings presentation?", ["The key insight", "Every raw row", "The file location", "Your tool list"], "The key insight"),
    mc("What is a limitation of an exact-match lookup?", ["It needs a consistent, matching key column", "It cannot return text", "It only works in Power BI", "It deletes rows"], "It needs a consistent, matching key column"),
    mc("What does connecting Power BI to a dataset let you do?", ["Build interactive, refreshable reports", "Only edit the raw CSV", "Replace Excel entirely", "Host your website"], "Build interactive, refreshable reports"),
    tf("A pivot chart visualizes summarized pivot data.", "True"),
    tf("Conditional formatting can highlight outliers automatically.", "True"),
    mc("Why keep a data dictionary or documentation?", ["So others understand fields and decisions", "To increase file size", "To add charts", "To hide data"], "So others understand fields and decisions"),
  ],
  "ai-video-generation-content-creation": [
    mc("What does a video prompt's camera direction control?", ["Framing and movement", "The music", "The captions", "The file format"], "Framing and movement"),
    mc("What is the risk of generating scenes with no plan?", ["Inconsistent characters, styles and wasted credits", "Higher resolution", "Faster export", "Better story"], "Inconsistent characters, styles and wasted credits"),
    mc("Which export orientation suits short vertical social videos?", ["9:16 vertical", "16:9 landscape", "Only square", "Print PDF"], "9:16 vertical"),
    mc("What should you verify about AI voice or music before commercial use?", ["Licensing and rights", "Font size", "Resolution", "Caption style"], "Licensing and rights"),
    mc("What makes a client promo video effective?", ["A clear message delivered in the first seconds", "A slow build", "No branding", "Many unrelated scenes"], "A clear message delivered in the first seconds"),
    mc("What is the best way to improve a weak AI clip?", ["Refine the prompt and regenerate", "Accept it", "Add loud music", "Remove captions"], "Refine the prompt and regenerate"),
    mc("What should be disclosed about AI-generated content?", ["That it is AI-generated where required", "Nothing", "Only the editor", "The file size"], "That it is AI-generated where required"),
    tf("AI can help script, generate, voice and edit, but human review still matters.", "True"),
    tf("Storyboarding helps control pace and continuity before generation.", "True"),
    mc("What does consistency across scenes protect?", ["Characters, style and world staying believable", "File size", "Upload speed", "Caption color"], "Characters, style and world staying believable"),
  ],
  "ai-automation-productivity": [
    mc("What is the output of a well-designed workflow?", ["A predictable, repeatable result", "Random behavior", "More manual work", "A design file"], "A predictable, repeatable result"),
    mc("Which task is a poor fit for automation?", ["A judgment call needing context and empathy", "Data entry", "Email routing", "File renaming"], "A judgment call needing context and empathy"),
    mc("What is an API in automation terms?", ["A way for apps to talk to each other", "A type of font", "A design tool", "A spreadsheet formula"], "A way for apps to talk to each other"),
    mc("Why review permissions when connecting apps?", ["To limit data exposure and risk", "To increase speed", "To add features", "To change colors"], "To limit data exposure and risk"),
    mc("What should you do when an automation fails repeatedly?", ["Investigate the root cause and add handling", "Ignore it", "Duplicate it", "Disable all automations"], "Investigate the root cause and add handling"),
    mc("What is the benefit of documenting automations?", ["Maintainability and smoother handover", "Higher cost", "Slower runs", "Less reliability"], "Maintainability and smoother handover"),
    mc("What does spotting automatable tasks start with?", ["Mapping your current manual process", "Buying software", "Hiring a developer", "Deleting data"], "Mapping your current manual process"),
    tf("Testing with sample data before going live reduces breakage.", "True"),
    tf("An automation can combine AI steps with rule-based steps.", "True"),
    mc("What is a good KPI for an automation?", ["Time saved or errors reduced", "The number of colors", "The logo size", "The file name"], "Time saved or errors reduced"),
  ],
  "prompt-engineering": [
    mc("What does a constraint in a prompt do?", ["Limits the response to what you need", "Removes the task", "Adds random facts", "Changes the model"], "Limits the response to what you need"),
    mc("Why include examples in a prompt?", ["They show the model the pattern you want", "They add length only", "They confuse the model", "They replace the task"], "They show the model the pattern you want"),
    mc("What is a common cause of vague AI output?", ["An underspecified prompt", "Too much context", "Clear constraints", "Good examples"], "An underspecified prompt"),
    mc("What does asking the model to reason step by step often improve?", ["Accuracy on complex tasks", "File size", "Model speed", "Color quality"], "Accuracy on complex tasks"),
    mc("How should you handle an AI answer that looks wrong?", ["Verify against sources and refine the prompt", "Trust it anyway", "Publish it", "Delete the project"], "Verify against sources and refine the prompt"),
    mc("What makes a prompt reusable?", ["A clear template with variable slots", "Random wording", "No structure", "Hidden constraints"], "A clear template with variable slots"),
    mc("What is the best way to improve at prompt engineering?", ["Test, measure and iterate deliberately", "Memorize one prompt", "Avoid feedback", "Copy blindly"], "Test, measure and iterate deliberately"),
    tf("Being specific about audience and tone improves writing prompts.", "True"),
    tf("Different models can require different prompting styles.", "True"),
    mc("What should be verified before using AI output professionally?", ["Facts, sources and fit for the task", "The font", "The file size", "The color"], "Facts, sources and fit for the task"),
  ],
  "ai-productivity-digital-work": [
    mc("What is the safest approach to AI-generated facts?", ["Verify against reliable sources", "Use them as-is", "Publish immediately", "Never check"], "Verify against reliable sources"),
    mc("Which task suits AI well?", ["Drafting and summarizing text", "Final legal decisions", "Medical diagnosis", "Guaranteeing accuracy"], "Drafting and summarizing text"),
    mc("What does a productivity system need to actually work?", ["Habit and a repeatable process", "The most tools", "Complexity", "No routine"], "Habit and a repeatable process"),
    mc("What is a risk of sharing sensitive data with AI tools?", ["Privacy and confidentiality breaches", "Higher resolution", "Slower internet", "Better design"], "Privacy and confidentiality breaches"),
    mc("How can AI help with meetings?", ["Transcribing and summarizing notes and actions", "Attending in your place", "Signing contracts", "Hiring staff"], "Transcribing and summarizing notes and actions"),
    mc("What is a good measure of an AI workflow's value?", ["Time saved and quality maintained", "Number of tools", "Length of prompts", "File size"], "Time saved and quality maintained"),
    mc("What should you do before submitting AI-assisted work?", ["Review, edit and take ownership of it", "Submit it unchanged", "Remove all context", "Hide that you used AI"], "Review, edit and take ownership of it"),
    tf("AI is best used as a collaborator you review, not an authority you trust blindly.", "True"),
    tf("Adapting AI output to your own voice and context improves results.", "True"),
    mc("What is the best way to start building an AI workflow?", ["Identify one recurring task and improve it", "Automate everything at once", "Buy all tools", "Avoid measuring"], "Identify one recurring task and improve it"),
  ],
});

EXAM_BATCHES.push({
  // ── Data, marketing & business ──────────────────────────────────
  "machine-learning-essentials": [
    mc("What is the difference between supervised and unsupervised learning?", ["Supervised uses labeled data; unsupervised finds structure in unlabeled data", "They are identical", "Unsupervised needs labels", "Supervised cannot predict"], "Supervised uses labeled data; unsupervised finds structure in unlabeled data"),
    mc("What does exploratory data analysis do?", ["Reveals patterns, distributions and issues before modeling", "Trains the final model", "Deploys the model", "Writes the report"], "Reveals patterns, distributions and issues before modeling"),
    mc("Which metric fits a regression problem?", ["RMSE", "F1-score", "Precision", "Accuracy"], "RMSE"),
    mc("Which metric handles imbalanced classification best?", ["F1-score or precision/recall", "Accuracy", "RMSE", "MAE"], "F1-score or precision/recall"),
    mc("What causes overfitting?", ["A model that memorizes training data instead of generalizing", "Too little data cleaning", "A slow computer", "Too few features"], "A model that memorizes training data instead of generalizing"),
    mc("What is feature engineering?", ["Creating useful inputs from raw fields to help the model", "Deleting columns", "Printing the data", "Choosing a library"], "Creating useful inputs from raw fields to help the model"),
    mc("What is a train/test split for?", ["Evaluating the model on data it has not seen", "Saving time", "Reducing file size", "Choosing a color"], "Evaluating the model on data it has not seen"),
    tf("scikit-learn provides tools for training and evaluating classical models.", "True"),
    tf("Adding more features does not always improve a model.", "True"),
    mc("What is a baseline model for?", ["A simple benchmark to beat before adding complexity", "The final deliverable", "A type of chart", "A data source"], "A simple benchmark to beat before adding complexity"),
  ],
  "marketing-fundamentals": [
    mc("What is the difference between marketing, sales and branding?", ["Marketing earns attention, sales closes, branding shapes perception", "They are identical", "Sales builds brands", "Branding closes deals"], "Marketing earns attention, sales closes, branding shapes perception"),
    mc("What is the first step in a marketing strategy?", ["Understanding the audience", "Choosing ad platforms", "Designing logos", "Setting a budget"], "Understanding the audience"),
    mc("What does a persona help you do?", ["Speak to a specific, real audience", "Set the ad budget", "Choose a font", "Write code"], "Speak to a specific, real audience"),
    mc("What is the core template of a positioning statement?", ["For [audience], [product] is the [category] that [benefit]", "Buy [product] now", "We are the best", "Our logo is green"], "For [audience], [product] is the [category] that [benefit]"),
    mc("Which funnel stage is brand awareness advertising for?", ["Awareness", "Conversion", "Retention", "Delivery"], "Awareness"),
    mc("How should channels be chosen?", ["By fit with your audience and funnel", "By hype", "By cost alone", "At random"], "By fit with your audience and funnel"),
    mc("What makes a story spread?", ["A strong hook, emotion and a reason to share", "Heavy jargon", "Long paragraphs", "No call to action"], "A strong hook, emotion and a reason to share"),
    tf("A positioning statement should guide every campaign you run.", "True"),
    tf("You can't market effectively to everyone at once.", "True"),
    mc("What is a call to action?", ["A clear instruction telling the audience what to do next", "A brand color", "A budget line", "A persona"], "A clear instruction telling the audience what to do next"),
  ],
  "growth-performance-marketing": [
    mc("What is the performance mindset?", ["Every dollar accountable to a measurable number", "Spend and hope", "Only brand awareness", "Only organic reach"], "Every dollar accountable to a measurable number"),
    mc("What should a landing page optimize for?", ["One clear conversion action", "Many competing goals", "Length", "Decoration"], "One clear conversion action"),
    mc("Why do many A/B tests fail to conclude?", ["They run too short or with too little traffic", "They change too little", "They use a hypothesis", "They measure results"], "They run too short or with too little traffic"),
    mc("What does attribution try to measure?", ["Which touchpoints contributed to a conversion", "The ad budget", "The design quality", "The team size"], "Which touchpoints contributed to a conversion"),
    mc("What is a cohort?", ["A group of users sharing a common trait or start period", "A single ad", "A landing page", "A budget"], "A group of users sharing a common trait or start period"),
    mc("What is a growth loop?", ["A system where output feeds new input", "A one-off campaign", "A single ad", "A banner"], "A system where output feeds new input"),
    mc("What should a hypothesis include?", ["A change, an expected effect and the metric you'll measure", "Only a change", "Only a metric", "Nothing"], "A change, an expected effect and the metric you'll measure"),
    tf("Referral and product-led loops can compound, unlike one-off campaigns.", "True"),
    tf("A landing page should usually have a single clear call to action.", "True"),
    mc("Which metric best measures ad efficiency?", ["CPA or CAC", "Impressions", "Page views", "Follower count"], "CPA or CAC"),
  ],
  "entrepreneurship-lean-startups": [
    mc("What should you do first with a new idea?", ["Validate the problem with customers", "Build the full product", "Register the company", "Hire a team"], "Validate the problem with customers"),
    mc("How many customer interviews is a good starting point?", ["About 20", "Zero", "One", "A hundred"], "About 20"),
    mc("What is an MVP?", ["The smallest experiment that tests your riskiest assumption", "A buggy prototype", "The final product", "A marketing video"], "The smallest experiment that tests your riskiest assumption"),
    mc("Which business model charges a recurring fee?", ["Subscription", "One-time sale", "Barter", "Donation only"], "Subscription"),
    mc("What is the riskiest assumption?", ["The belief that, if wrong, breaks the business", "The logo", "The office lease", "The website font"], "The belief that, if wrong, breaks the business"),
    mc("What should a pitch deck cover?", ["Problem, solution, market, business model and the ask", "Only the logo", "Only the price", "Only the team"], "Problem, solution, market, business model and the ask"),
    mc("Why do unit economics matter?", ["They show whether growth actually makes money", "They set the logo size", "They pick the colors", "They hire staff"], "They show whether growth actually makes money"),
    tf("Discovery interviews should ask about past behavior, not hypotheticals.", "True"),
    tf("A landing page can be a valid MVP for testing demand.", "True"),
    mc("What is a good sign a problem is worth solving?", ["People already pay or work around it", "Your friends like the idea", "The logo is ready", "The domain is free"], "People already pay or work around it"),
  ],
});

EXAM_BATCHES.push({
  // ── Development roadmap ─────────────────────────────────────────
  "html-css-the-modern-web": [
    mc("What happens when you type a URL into a browser?", ["The browser requests the page from a server and renders it", "The browser emails the site", "The server prints the page", "Nothing happens"], "The browser requests the page from a server and renders it"),
    mc("Why is semantic HTML valuable?", ["It improves accessibility, SEO and maintainability", "It makes pages load slower", "It replaces CSS", "It removes the need for JavaScript"], "It improves accessibility, SEO and maintainability"),
    mc("What does a CSS custom property (variable) let you do?", ["Reuse a value and change it in one place", "Add images", "Write HTML", "Host a site"], "Reuse a value and change it in one place"),
    mc("Which layout engine handles two-dimensional grids?", ["CSS Grid", "Flexbox", "Float", "Position absolute"], "CSS Grid"),
    mc("What is the mobile-first trade-off?", ["It starts with the smallest screen and enhances upward", "It ignores desktop", "It only targets phones", "It is identical to desktop-first"], "It starts with the smallest screen and enhances upward"),
    mc("What does the <main> element represent?", ["The primary content of the page", "The navigation", "The footer", "The sidebar only"], "The primary content of the page"),
    mc("What is fluid type?", ["Type that scales with the viewport, often with clamp()", "Type that never changes", "Only uppercase text", "Type with no line height"], "Type that scales with the viewport, often with clamp()"),
    tf("Deploying to free static hosting gives your site a live URL to share.", "True"),
    tf("Git lets you track changes and collaborate on your code.", "True"),
    mc("Why does the box model matter?", ["Padding, border and margin affect an element's actual size", "It controls the fonts", "It sets the colors", "It manages the server"], "Padding, border and margin affect an element's actual size"),
  ],
  "javascript-deep-dive": [
    mc("What is type coercion?", ["JavaScript automatically converting values between types", "A syntax error", "A CSS feature", "A network request"], "JavaScript automatically converting values between types"),
    mc("What is a higher-order function?", ["A function that takes or returns another function", "A function with many lines", "A CSS rule", "A class only"], "A function that takes or returns another function"),
    mc("What does the DOM represent?", ["The page as objects your code can read and change", "A database", "A network protocol", "A build tool"], "The page as objects your code can read and change"),
    mc("What does the reduce array method do?", ["Combines items into a single accumulated value", "Filters items", "Sorts items", "Adds an item"], "Combines items into a single accumulated value"),
    mc("What does await do?", ["Pauses an async function until a promise settles", "Runs code twice", "Blocks the whole browser", "Creates a variable"], "Pauses an async function until a promise settles"),
    mc("What is the purpose of a module?", ["To split code into importable, reusable pieces", "To make files larger", "To style the page", "To replace HTML"], "To split code into importable, reusable pieces"),
    mc("What does fetch return?", ["A promise that resolves to a response", "A string immediately", "An array", "A number"], "A promise that resolves to a response"),
    tf("try/catch is used to handle errors in async code.", "True"),
    tf("map, filter and reduce return new values instead of mutating the original array.", "True"),
    mc("What is the difference between let and const?", ["const cannot be reassigned; let can", "let is global; const is local", "They are identical", "const only works in loops"], "const cannot be reassigned; let can"),
  ],
  "backend-apis-with-node": [
    mc("Which HTTP verb reads data without changing it?", ["GET", "POST", "PUT", "DELETE"], "GET"),
    mc("Which status code means a resource was not found?", ["404", "200", "301", "500"], "404"),
    mc("Which status code means the server errored?", ["500", "200", "404", "302"], "500"),
    mc("Why hash passwords before storing them?", ["So a data leak does not expose the real passwords", "To speed up login", "To make them shorter", "To email them"], "So a data leak does not expose the real passwords"),
    mc("What is a JSON response body?", ["Structured data the client can parse", "A CSS file", "An image", "An error only"], "Structured data the client can parse"),
    mc("What does a route define?", ["A path and method the server responds to", "A database table", "A font", "A build step"], "A path and method the server responds to"),
    mc("What is environment configuration for?", ["Keeping secrets and per-environment values out of code", "Styling pages", "Writing docs", "Caching responses"], "Keeping secrets and per-environment values out of code"),
    tf("Automated tests turn a demo into a more trustworthy product.", "True"),
    tf("An OpenAPI document describes your API so others can use it.", "True"),
    mc("What does CRUD stand for?", ["Create, Read, Update, Delete", "Connect, Route, Use, Deploy", "Copy, Run, Undo, Debug", "Cache, Reset, Upload, Download"], "Create, Read, Update, Delete"),
  ],
  "full-stack-project-build-an-lms": [
    mc("Why separate frontend and backend concerns?", ["Clear boundaries and independent scaling", "Less code", "Better fonts", "No benefit"], "Clear boundaries and independent scaling"),
    mc("Where should role checks live?", ["On the server in every protected path", "Only in the UI", "In the database schema only", "In the README"], "On the server in every protected path"),
    mc("What is a data model?", ["A description of entities and how they relate", "A CSS layout", "A marketing plan", "A test suite"], "A description of entities and how they relate"),
    mc("What should an auth flow handle?", ["Sign up, sign in, sessions and protected routes", "Only styling", "Only emails", "Only hosting"], "Sign up, sign in, sessions and protected routes"),
    mc("What does the admin area typically do?", ["Let trusted users manage content and users", "Host the database", "Replace authentication", "Design the logo"], "Let trusted users manage content and users"),
    mc("Why record an architecture walkthrough?", ["It demonstrates how the product works end to end", "It replaces the code", "It sets the price", "It buys hosting"], "It demonstrates how the product works end to end"),
    tf("Environment variables should never be committed to the repository.", "True"),
    tf("Testing edge cases before launch reduces production surprises.", "True"),
    mc("What is the benefit of seeding data?", ["Realistic content for building and demos", "Faster hosting", "Better security", "Smaller bundles"], "Realistic content for building and demos"),
    mc("What should the capstone deliver?", ["A deployed product plus a walkthrough", "Only a design file", "Only a report", "Only a logo"], "A deployed product plus a walkthrough"),
  ],
  "data-analytics-foundations": [
    mc("What is a vanity metric?", ["A metric that looks impressive but drives no decision", "A metric with no numbers", "A private metric", "A fake metric"], "A metric that looks impressive but drives no decision"),
    mc("How does good analysis start?", ["With a clear, measurable question", "With a chart", "With a tool purchase", "With a slide template"], "With a clear, measurable question"),
    mc("What does a pivot table do?", ["Groups and summarizes data into a table", "Sorts colors", "Edits images", "Hosts files"], "Groups and summarizes data into a table"),
    mc("What is a benchmark?", ["A reference point to compare performance against", "A type of chart", "A formula", "A database"], "A reference point to compare performance against"),
    mc("Why document data decisions?", ["So others can trust and reproduce the analysis", "To increase file size", "To add color", "To hide data"], "So others can trust and reproduce the analysis"),
    mc("What is the last step of a first analysis?", ["Turning findings into a clear, actionable story", "Deleting the data", "Buying more software", "Formatting every cell"], "Turning findings into a clear, actionable story"),
    tf("Clean data prevents more errors than advanced tools prevent.", "True"),
    tf("Actionable metrics are tied to a decision you can make.", "True"),
    mc("Which question is measurable?", ["How many users churned last month?", "Do users like us?", "Is our brand cool?", "Should we be famous?"], "How many users churned last month?"),
    mc("What is an outlier?", ["A value far from the rest of the data", "A missing value", "A duplicate value", "A formatted cell"], "A value far from the rest of the data"),
  ],
  "sql-data-wrangling": [
    mc("Which JOIN returns all rows from the left table and matches from the right?", ["LEFT JOIN", "INNER JOIN", "RIGHT JOIN", "CROSS JOIN"], "LEFT JOIN"),
    mc("Which clause filters groups after aggregation?", ["HAVING", "WHERE", "ORDER BY", "LIMIT"], "HAVING"),
    mc("Which function returns the average of a column?", ["AVG", "SUM", "COUNT", "MAX"], "AVG"),
    mc("What is a subquery?", ["A query nested inside another query", "A type of index", "A stored procedure", "A table join"], "A query nested inside another query"),
    mc("What does a window function's OVER clause define?", ["The rows the calculation applies to", "The sort order only", "The output format", "The database engine"], "The rows the calculation applies to"),
    mc("What does CASE do?", ["Returns different values based on conditions", "Joins tables", "Deletes rows", "Creates an index"], "Returns different values based on conditions"),
    mc("What is deduplication?", ["Removing repeated rows so each record appears once", "Sorting rows", "Renaming columns", "Backing up data"], "Removing repeated rows so each record appears once"),
    tf("A CTE can make a complex query easier to read and reuse.", "True"),
    tf("INNER JOIN returns only rows that match in both tables.", "True"),
    mc("Why is SQL still essential in data work?", ["It queries and shapes data at the source", "It only makes charts", "It replaces spreadsheets", "It designs dashboards"], "It queries and shapes data at the source"),
  ],
});
EXAM_BATCHES.push({
  // ── Design roadmap ──────────────────────────────────────────────
  "design-fundamentals": [
    mc("Which of these is a design element rather than a principle?", ["Texture", "Balance", "Contrast", "Rhythm"], "Texture", "Line, shape, form, space, texture and value are elements; balance, contrast and rhythm are principles."),
    mc("What is value in design?", ["The lightness or darkness of a color", "The price of a brand", "The size of the type", "The number of colors used"], "The lightness or darkness of a color"),
    mc("What does a type scale set?", ["The relative sizes of headings and body text", "The color palette", "The grid columns", "The print bleed"], "The relative sizes of headings and body text"),
    mc("What is visual hierarchy?", ["Arranging elements so viewers know where to look first", "Making every element the same size", "Using only one color", "Centering everything"], "Arranging elements so viewers know where to look first"),
    mc("What is the primary purpose of whitespace?", ["Giving content room to breathe and improving focus", "Wasting paper", "Reducing file size", "Fitting in more content"], "Giving content room to breathe and improving focus"),
    mc("Which tool is introduced for the mini-brand project?", ["Figma", "Photoshop", "Blender", "Excel"], "Figma"),
    mc("What should a palette provide for accessibility?", ["Sufficient contrast between text and background", "More than ten colors", "Only pastel shades", "No neutrals"], "Sufficient contrast between text and background"),
    tf("A grid helps align elements and keeps layouts consistent.", "True"),
    tf("Design principles are the recipe applied to the raw elements.", "True"),
    mc("Kerning refers to what?", ["The space between individual letters", "The space between lines", "The page margin", "The image resolution"], "The space between individual letters"),
  ],
  "branding-essentials": [
    mc("What is the difference between a logo and a brand?", ["A logo is a mark; a brand is the whole experience", "They are identical", "A brand is only a color", "A logo is only a tagline"], "A logo is a mark; a brand is the whole experience"),
    mc("What is a positioning statement for?", ["Defining audience, category and difference", "Choosing a font", "Listing deliverables", "Setting the print size"], "Defining audience, category and difference"),
    mc("Which comes first in a branding project?", ["Research and positioning", "Logo sketches", "Business cards", "Color palette"], "Research and positioning"),
    mc("What is a competitive audit?", ["Studying how competitors present themselves", "Copying a competitor's logo", "Printing a survey", "Buying ad space"], "Studying how competitors present themselves"),
    mc("What does tone of voice describe?", ["How the brand sounds in its writing", "The logo weight", "The paper stock", "The font size"], "How the brand sounds in its writing"),
    mc("Why do brand guidelines matter?", ["They keep a brand consistent wherever it appears", "They increase file size", "They replace the logo", "They are only for printers"], "They keep a brand consistent wherever it appears"),
    tf("A moodboard explores visual direction before final design decisions.", "True"),
    tf("A final logo should work in one color and at small sizes.", "True"),
    mc("Why present a small number of refined concepts?", ["It focuses the client's decision", "It hides the process", "It avoids feedback", "It speeds up printing"], "It focuses the client's decision"),
    mc("What belongs in a brand handoff?", ["Logo files, colors, type, voice and usage rules", "Only a JPG logo", "The invoice only", "A list of employees"], "Logo files, colors, type, voice and usage rules"),
  ],
  "ui-design-mastery": [
    mc("What is a design token?", ["A named value such as a color or spacing step", "A password for Figma", "A type of font", "A user avatar"], "A named value such as a color or spacing step"),
    mc("What is a sitemap used for?", ["Mapping the pages and hierarchy of a product", "Choosing fonts", "Writing copy", "Exporting files"], "Mapping the pages and hierarchy of a product"),
    mc("Why prototype interactions before development?", ["To validate the flow and catch issues early", "To replace developers", "To set the price", "To write documentation"], "To validate the flow and catch issues early"),
    mc("What is component thinking?", ["Building reusable UI pieces used across screens", "Designing one screen only", "Using a single color", "Avoiding grids"], "Building reusable UI pieces used across screens"),
    mc("What is the goal of a usability test?", ["Watching real users try tasks to find problems", "Proving the design is perfect", "Choosing a color palette", "Writing code"], "Watching real users try tasks to find problems"),
    mc("Which spacing approach keeps layouts consistent?", ["A defined spacing scale or tokens", "Randomly chosen gaps", "Only negative margins", "Fixed pixel values everywhere"], "A defined spacing scale or tokens"),
    tf("Wireframes should avoid final colors and imagery.", "True"),
    tf("Naming and organizing layers makes handoff easier.", "True"),
    mc("What does developer handoff include?", ["Specs, assets and interaction notes", "Only the final image", "A verbal description", "The project budget"], "Specs, assets and interaction notes"),
    mc("Why test with a small number of users first?", ["A few users surface most of the biggest problems", "Testing is expensive", "Only experts matter", "Users are all identical"], "A few users surface most of the biggest problems"),
  ],
  "portfolio-career-launchpad": [
    mc("What should a case study lead with?", ["The problem and the result", "Your list of tools", "Your biography", "Client testimonials"], "The problem and the result"),
    mc("What is the ideal number of projects on a focused portfolio?", ["Three strong, focused ones", "Ten shallow ones", "As many as possible", "Only one"], "Three strong, focused ones"),
    mc("What makes a resume easier to scan?", ["Action verbs and measurable outcomes", "Long paragraphs", "Decorative fonts", "No dates"], "Action verbs and measurable outcomes"),
    mc("What is the STAR method?", ["Situation, Task, Action, Result", "Screen, Test, Approve, Release", "Sketch, Trace, Apply, Render", "Start, Try, Adjust, Repeat"], "Situation, Task, Action, Result"),
    mc("Why tailor your application per role?", ["It shows fit and improves your odds", "It is required by law", "It changes the interview", "It replaces a portfolio"], "It shows fit and improves your odds"),
    mc("What is a good portfolio site structure?", ["A clear one-page flow with strong work first", "A long blog", "A hidden menu", "Only a resume PDF"], "A clear one-page flow with strong work first"),
    tf("Showing process and results beats showing only final images.", "True"),
    tf("Critique in an interview is a normal part of the process.", "True"),
    mc("What should you research before an interview?", ["The company, role and interviewers", "Their competitors' logos", "Your own commute", "The office furniture"], "The company, role and interviewers"),
    mc("What is a professional way to discuss a failed project?", ["Explain what you learned and how you improved", "Hide it", "Blame the client", "Avoid the topic"], "Explain what you learned and how you improved"),
  ],
  "professional-graphic-design": [
    mc("What is the correct order of the client design process?", ["Brief, research, concept, design, revise, deliver", "Design, brief, invoice, deliver", "Deliver, research, design, brief", "Concept, deliver, brief, research"], "Brief, research, concept, design, revise, deliver"),
    mc("What is a brand identity system?", ["A toolkit of logo, palette, type and usage rules", "A single logo file", "A business card", "A website"], "A toolkit of logo, palette, type and usage rules"),
    mc("What is safe margin?", ["The area kept clear so content is not trimmed", "The cost of printing", "The number of colors", "The image resolution"], "The area kept clear so content is not trimmed"),
    mc("What is the purpose of a campaign key visual?", ["One strong idea adapted across all formats", "A random image", "A logo repeat", "A pricing table"], "One strong idea adapted across all formats"),
    mc("What makes a promotional flyer effective?", ["Clear hierarchy, one offer and one call to action", "Many competing messages", "Tiny text", "No contact details"], "Clear hierarchy, one offer and one call to action"),
    mc("What is a dieline?", ["A guide showing where a printed piece folds or cuts", "A color palette", "A font pairing", "A file format"], "A guide showing where a printed piece folds or cuts"),
    tf("A brand presentation should tell the strategy story, not just show the logo.", "True"),
    tf("Print work uses CMYK while screens use RGB.", "True"),
    mc("Why is a consistent template system valuable for a brand?", ["Every post stays recognizable and fast to produce", "It hides the brand", "It reduces quality", "It replaces strategy"], "Every post stays recognizable and fast to produce"),
    mc("What is the goal of the capstone client project?", ["Running a full project from brief to final delivery", "Only making a logo", "Only writing a report", "Only presenting ideas"], "Running a full project from brief to final delivery"),
  ],
});
EXAM_BATCHES.push({
  // ── Photoshop & video editing ───────────────────────────────────
  "photoshop-mastery": [
    mc("What is the layers panel used for?", ["Managing the stacking order and visibility of layers", "Changing the canvas size", "Exporting files", "Writing text"], "Managing the stacking order and visibility of layers"),
    mc("What does a layer mask use to hide and reveal pixels?", ["Black and white", "Only colors", "Filters", "Blur"], "Black and white"),
    mc("Which tool is most precise for creating cutout paths?", ["Pen", "Brush", "Eraser", "Gradient"], "Pen"),
    mc("What is the main benefit of an adjustment layer?", ["It changes color non-destructively", "It deletes pixels", "It flattens the file", "It adds text"], "It changes color non-destructively"),
    mc("What does the Multiply blending mode do?", ["Darkens by multiplying the underlying colors", "Lightens everything", "Adds noise", "Sharpens edges"], "Darkens by multiplying the underlying colors"),
    mc("Why use smart objects?", ["They keep transformations and filters editable", "They reduce file size only", "They add color", "They replace masks"], "They keep transformations and filters editable"),
    mc("What is the Clone Stamp best for?", ["Copying pixels from one area to another", "Adding text", "Changing resolution", "Selecting colors"], "Copying pixels from one area to another"),
    mc("What does Refine Edge help with?", ["Cleaning up the edges of a selection", "Adding typography", "Building grids", "Recording actions"], "Cleaning up the edges of a selection"),
    tf("Frequency-based cleanup should preserve natural skin texture.", "True"),
    mc("What is a sensible first step in color correction?", ["Fix white balance", "Add a vignette", "Increase saturation", "Crop tightly"], "Fix white balance"),
  ],
  "video-editing-with-capcut": [
    mc("What is the most important editing skill?", ["Knowing what to remove", "Adding effects", "Using every transition", "Making it loud"], "Knowing what to remove"),
    mc("What does the timeline show?", ["The arrangement of clips and audio over time", "The export settings", "The media file list", "The color palette"], "The arrangement of clips and audio over time"),
    mc("What is the media bin for?", ["Holding imported footage before it reaches the timeline", "Exporting video", "Adding captions", "Grading color"], "Holding imported footage before it reaches the timeline"),
    mc("What resolution and orientation suit a vertical social video?", ["1080x1920 vertical 9:16", "1920x1080 landscape 16:9", "Only 4K square", "Print PDF"], "1080x1920 vertical 9:16"),
    mc("Why trim the start of a clip?", ["To remove dead air and start on action", "To change resolution", "To add music", "To add captions"], "To remove dead air and start on action"),
    mc("What should a transition do?", ["Serve the story rather than dominate it", "Appear every second", "Replace editing", "Change the frame rate"], "Serve the story rather than dominate it"),
    mc("How do you cut on action?", ["Cut during movement so the edit feels seamless", "Cut only between static shots", "Cut mid-sentence", "Cut randomly"], "Cut during movement so the edit feels seamless"),
    tf("Exporting at a much higher resolution than the source does not add real detail.", "True"),
    tf("Title text should be readable and consistent with the brand.", "True"),
    mc("What is the purpose of the export settings?", ["Matching resolution, frame rate and bitrate to the platform", "Adding music", "Trimming clips", "Writing titles"], "Matching resolution, frame rate and bitrate to the platform"),
  ],
  "capcut-pro-editing": [
    mc("What are keyframes used for?", ["Animating properties like position and scale over time", "Storing backups", "Changing resolution", "Auto-captioning"], "Animating properties like position and scale over time"),
    mc("What does a speed curve let you do?", ["Ramp smoothly between slow and fast motion", "Change the frame rate", "Export faster", "Add tracks"], "Ramp smoothly between slow and fast motion"),
    mc("What does color grading balance between clips?", ["Exposure, contrast and color so the look is consistent", "Audio levels", "Frame rate", "File names"], "Exposure, contrast and color so the look is consistent"),
    mc("Why use curves in grading?", ["To shape contrast and tone precisely", "To add captions", "To trim clips", "To sync audio"], "To shape contrast and tone precisely"),
    mc("What does ducking audio do?", ["Lowers music automatically under dialogue", "Raises the pitch", "Removes captions", "Adds echo"], "Lowers music automatically under dialogue"),
    mc("What makes captions effective?", ["Readable timing and styling that matches the brand", "Tiny fonts", "No timing", "Random colors"], "Readable timing and styling that matches the brand"),
    mc("How many angles make a story rather than a single take?", ["Two or more cut together", "One long take", "Only a title card", "A slideshow"], "Two or more cut together"),
    tf("Effects are best used sparingly and with purpose.", "True"),
    tf("A master export can be reused to create platform-specific versions later.", "True"),
    mc("What is the goal of sound design?", ["Clean dialogue, balanced music and fitting effects", "Maximum volume", "No audio", "Only voiceover"], "Clean dialogue, balanced music and fitting effects"),
  ],
  "capcut-pro-storytelling": [
    mc("What is the first step in a professional editing project?", ["Understanding the brief and planning the story", "Adding effects", "Exporting", "Buying music"], "Understanding the brief and planning the story"),
    mc("What are the three beats of video story structure?", ["Hook, build, payoff", "Intro, credits, ad", "Logo, price, contact", "Setup, logo, subscribe"], "Hook, build, payoff"),
    mc("What does chroma key let you do?", ["Replace a green background with another image or video", "Speed up a clip", "Add captions", "Change the frame rate"], "Replace a green background with another image or video"),
    mc("What does shot matching ensure?", ["Clips share consistent exposure and color", "Clips have the same length", "Clips share captions", "Clips share audio"], "Clips share consistent exposure and color"),
    mc("What is a signature look?", ["A consistent grade a brand can rely on", "A one-off filter", "A random preset", "A caption style"], "A consistent grade a brand can rely on"),
    mc("Why use an edit system with intro, captions and outro?", ["It keeps every post on-brand and fast to produce", "It reduces quality", "It removes editing", "It avoids music"], "It keeps every post on-brand and fast to produce"),
    mc("What does logging footage involve?", ["Reviewing and organizing clips so they are findable", "Deleting all footage", "Exporting early", "Adding captions"], "Reviewing and organizing clips so they are findable"),
    tf("A lighting note for green screen should avoid shading and spill.", "True"),
    tf("Handling revision rounds well protects both the cut and the relationship.", "True"),
    mc("What should you check before delivering a final export?", ["Picture, audio, captions and specs for the platform", "Only the file name", "Only the thumbnail", "Nothing"], "Picture, audio, captions and specs for the platform"),
  ],
  "photoshop-pro-workflows": [
    mc("What does frequency separation let you do?", ["Smooth skin without losing texture detail", "Add text", "Change resolution", "Record actions"], "Smooth skin without losing texture detail"),
    mc("What is the key to a believable composite?", ["Matching light, color and perspective", "Using the same file name", "Adding filters", "Increasing saturation"], "Matching light, color and perspective"),
    mc("Why keep edits reversible?", ["So revisions and client changes are easy", "To make files smaller", "To speed up export", "To add color"], "So revisions and client changes are easy"),
    mc("When is recording an action worthwhile?", ["When you repeat the same steps across many files", "For one-off edits", "Only for print", "Never"], "When you repeat the same steps across many files"),
    mc("What must a print-ready file include?", ["CMYK, correct resolution and bleed", "RGB only", "72 dpi only", "No margins"], "CMYK, correct resolution and bleed"),
    mc("Why organize layers and name files clearly?", ["It makes collaboration and handoff smooth", "It increases resolution", "It adds effects", "It improves color"], "It makes collaboration and handoff smooth"),
    mc("What is a smart filter?", ["A filter that stays editable on a smart object", "A locked filter", "A print filter", "A color mode"], "A filter that stays editable on a smart object"),
    tf("Batch processing can apply one recorded action across a folder of images.", "True"),
    tf("A portfolio retouching project should show process as well as the result.", "True"),
    mc("What is the capstone client delivery?", ["A full retouch, composite and print/screen handoff", "Only a logo", "Only a report", "Only a color swatch"], "A full retouch, composite and print/screen handoff"),
  ],
});
// __EXAM_BATCHES__

export const QUIZ_ADDITIONS: Record<string, Question[][]> = Object.assign(
  {},
  ...QUIZ_BATCHES,
);
export const EXAM_ADDITIONS: Record<string, Question[]> = Object.assign(
  {},
  ...EXAM_BATCHES,
);

/** Every additional question for a course (used to compose the exam). */
export function bankQuestionsFor(slug: string): Question[] {
  const quiz = QUIZ_ADDITIONS[slug]?.flat() ?? [];
  const exam = EXAM_ADDITIONS[slug] ?? [];
  return [...quiz, ...exam];
}

export function quizAdditionsFor(slug: string, index: number): Question[] {
  return QUIZ_ADDITIONS[slug]?.[index] ?? [];
}
