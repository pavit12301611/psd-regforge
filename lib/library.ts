/**
 * RegForge — question library
 * 12 modules, 50 questions. Stable ids: "module.question".
 * "*" = required by default. Options are written as pipe-separated strings.
 */

export type QuestionType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'rating' | 'currency';

export interface Question {
  /** Stable id, format "module.question" */
  id: string;
  type: QuestionType;
  label: string;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** ISO currency code for `type: 'currency'` questions. Currently always INR. */
  currency?: 'INR';
  required?: boolean;
}

export interface LibraryModule {
  key: string;
  title: string;
  blurb: string;
  icon?: string;
  questions: Question[];
}

/** Splits "a | b | c" into trimmed options. */
const O = (raw: string): string[] =>
  raw
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

export const MODULES: LibraryModule[] = [
  {
    key: 'basics',
    title: 'About the project',
    blurb: 'Kick-off facts: what the business is, who it serves, and where it stands today.',
    questions: [
      {
        id: 'basics.name',
        type: 'text',
        label: 'What is the name of your project or business?',
        placeholder: 'e.g. The Daily Bloom',
        required: true,
      },
      {
        id: 'basics.one_liner',
        type: 'textarea',
        label: 'Describe your project in one or two sentences.',
        required: true,
      },
      {
        id: 'basics.purpose',
        type: 'checkbox',
        label: 'What is the main purpose of the website?',
        options: O(
          'Sell products or services | Provide information | Generate leads / enquiries | Showcase a portfolio | Bookings / appointments | Community / memberships | Something else',
        ),
      },
      {
        id: 'basics.audience',
        type: 'textarea',
        label: 'Who is your target audience? Describe them (age, location, interests…).',
      },
      {
        id: 'basics.current_site',
        type: 'radio',
        label: 'Do you have an existing website?',
        options: O(
          'No, this is my first site | Yes, and I want to keep it | Yes, but I want a redesign',
        ),
      },
      {
        id: 'basics.satisfaction',
        type: 'rating',
        label: 'How satisfied are you with your current online presence?',
        help: '1 = not happy at all, 5 = love it',
      },
    ],
  },
  {
    key: 'pages',
    title: 'Pages & structure',
    blurb: 'Which pages should the site have, and what goes on the homepage.',
    questions: [
      {
        id: 'pages.pages',
        type: 'checkbox',
        label: 'Tick every page the website should include.',
        required: true,
        options: O(
          'Home | About | Services | Portfolio / Work | Products / Shop | Blog / News | Pricing | FAQ | Contact | Testimonials | Gallery | Team | Events | Login / Account | Legal / Privacy',
        ),
      },
      {
        id: 'pages.structure',
        type: 'radio',
        label: 'Should the site be a single page or a multi-page site?',
        options: O('Single page (one long scrolling page) | Multi-page | Not sure — advise me'),
      },
      {
        id: 'pages.sections',
        type: 'checkbox',
        label: 'Which sections should the HOMEPAGE include?',
        options: O(
          'Hero / intro | About us | Services / what we do | Portfolio / examples | Testimonials | Pricing | Contact form | Blog / latest news | Client logos | FAQ | Newsletter signup | Map & location | Stats / numbers',
        ),
      },
      {
        id: 'pages.nav',
        type: 'text',
        label: 'Any special menu items or navigation requirements?',
      },
    ],
  },
  {
    key: 'features',
    title: 'Features & functionality',
    blurb: 'What the site must actually DO — the interactive parts.',
    questions: [
      {
        id: 'features.features',
        type: 'checkbox',
        label: 'Tick every feature the website needs.',
        required: true,
        options: O(
          'Contact form | Live chat / chat widget | Booking / calendar system | Payments / checkout | User accounts & login | Search | Newsletter signup | Image gallery | Video / video embeds | Google Maps | Reviews / ratings | Downloadable files | Multi-language | Blog / CMS | Admin dashboard | Third-party API integration | Social media feed | Chatbot',
        ),
      },
      {
        id: 'features.important',
        type: 'textarea',
        label: 'Which features are the most important? Rank them or explain why.',
      },
      {
        id: 'features.integrations',
        type: 'checkbox',
        label: 'Should it integrate with any of these tools?',
        options: O(
          'Google Analytics | Email marketing (Mailchimp, Klaviyo…) | CRM (HubSpot, Salesforce…) | Payment gateway (Stripe, PayPal…) | Social media | Booking system | Zapier / automations | None of these',
        ),
      },
      {
        id: 'features.other_tools',
        type: 'textarea',
        label: 'List any other tools or services the site must connect to.',
      },
    ],
  },
  {
    key: 'design',
    title: 'Design & branding',
    blurb: 'Look & feel: style, colors, logo, and sites they love (or hate).',
    questions: [
      {
        id: 'design.style',
        type: 'radio',
        label: 'Which design style appeals to you most?',
        options: O(
          'Minimal & clean | Bold & colorful | Playful & fun | Corporate & professional | Luxury & premium | Modern & trendy | Vintage / retro | Dark & edgy',
        ),
      },
      {
        id: 'design.colors',
        type: 'text',
        label: 'Do you have brand colors? (hex codes, names, or a description)',
      },
      {
        id: 'design.logos',
        type: 'radio',
        label: 'Do you have a logo?',
        options: O('Yes, I have files | No, I need one designed | Not sure yet'),
      },
      { id: 'design.vibe', type: 'text', label: 'Describe the feeling the site should give visitors.' },
      {
        id: 'design.inspiration',
        type: 'textarea',
        label: 'Links to websites you like — and what you like about them.',
      },
      { id: 'design.dislike', type: 'textarea', label: "Websites you DON'T like — and what to avoid." },
      {
        id: 'design.images',
        type: 'radio',
        label: 'Do you have your own photos and images?',
        options: O('Yes | Some of them | No — use stock photos | Not sure'),
      },
    ],
  },
  {
    key: 'content',
    title: 'Content',
    blurb: 'Who provides the text, images and copy — and when.',
    questions: [
      {
        id: 'content.ready',
        type: 'radio',
        label: 'Is all the text content ready?',
        options: O('Yes, all written | Mostly — a few gaps | No, I need help writing it | No content at all yet'),
      },
      {
        id: 'content.writer',
        type: 'radio',
        label: 'Who will write the content?',
        options: O('Me | My team | You (the agency) | A mix of us'),
      },
      {
        id: 'content.languages',
        type: 'text',
        label: 'Should the site be available in any language other than English?',
      },
      {
        id: 'content.media',
        type: 'checkbox',
        label: 'What media assets will you provide?',
        options: O(
          'Logos & brand files | Photos | Videos | Documents / PDFs | Product data (spreadsheets) | Nothing yet',
        ),
      },
    ],
  },
  {
    key: 'ecommerce',
    title: 'E-commerce',
    blurb: "Only matters if you're selling online — products, payments, delivery.",
    questions: [
      {
        id: 'ecommerce.products',
        type: 'radio',
        label: 'How many products will you sell?',
        options: O('1–10 | 11–50 | 51–200 | 200+ | Not sure yet'),
      },
      {
        id: 'ecommerce.type',
        type: 'radio',
        label: 'Are you selling physical products, digital products, or both?',
        options: O('Physical products | Digital products | Both | Services (booked online)'),
      },
      {
        id: 'ecommerce.payments',
        type: 'checkbox',
        label: 'Which payment methods should be accepted?',
        options: O(
          'Credit / debit card | PayPal | Stripe | Apple Pay / Google Pay | Bank transfer | Cash on delivery | Other',
        ),
      },
      {
        id: 'ecommerce.stock',
        type: 'radio',
        label: 'Do you need inventory / stock management?',
        options: O('Yes | No | Not sure'),
      },
      {
        id: 'ecommerce.shipping',
        type: 'textarea',
        label: 'Any shipping or delivery requirements?',
      },
    ],
  },
  {
    key: 'budget',
    title: 'Budget & pricing',
    blurb: 'A tricky but essential conversation — captured as a free-form amount in Indian Rupees.',
    questions: [
      {
        // Stable id kept on purpose: answers saved against the old dollar
        // range radio list stay attached to `budget.budget` and are rendered
        // as-is (see lib/answers.ts). The answer is now free-form INR.
        id: 'budget.budget',
        type: 'currency',
        currency: 'INR',
        label: 'What is your budget for this project?',
        placeholder: 'e.g. ₹50,000',
        help: 'Enter any amount in Indian Rupees (INR). You can include commas — e.g. ₹1,25,000 or ₹10,00,000.',
        required: true,
      },
      {
        id: 'budget.monthly',
        type: 'radio',
        label: 'Do you expect ongoing monthly costs (hosting, maintenance, updates)?',
        options: O('Yes, budgeted for | Maybe — explain options | No'),
      },
      {
        id: 'budget.notes',
        type: 'textarea',
        label: 'Anything else about budget we should know?',
      },
    ],
  },
  {
    key: 'timeline',
    title: 'Timeline',
    icon: '⏰',
    blurb: 'Deadlines, urgency and whether a phased launch works.',
    questions: [
      { id: 'timeline.deadline', type: 'text', label: 'When do you need the website live? (date)' },
      {
        id: 'timeline.speed',
        type: 'radio',
        label: 'How urgent is this project?',
        options: O('As soon as possible | Within a month | 1–3 months | 3+ months | Flexible / no rush'),
      },
      {
        id: 'timeline.phases',
        type: 'radio',
        label: 'Is a phased launch OK (launch the core site first, add features later)?',
        options: O('Yes | No — everything at once | Not sure'),
      },
    ],
  },
  {
    key: 'hosting',
    title: 'Domain & hosting',
    blurb: 'The plumbing: domain, email and where the site will live.',
    questions: [
      {
        id: 'hosting.domain',
        type: 'radio',
        label: 'Do you already have a domain name?',
        options: O('Yes | No — I need to buy one | Not sure'),
      },
      {
        id: 'hosting.email',
        type: 'radio',
        label: 'Do you need a professional email address (you@yourdomain.com)?',
        options: O('Yes | No | Already have one'),
      },
      {
        id: 'hosting.hosting',
        type: 'radio',
        label: 'Do you have hosting?',
        options: O('Yes | No | Not sure what that is'),
      },
      {
        id: 'hosting.platform',
        type: 'radio',
        label: 'Any preference for the technology / platform?',
        options: O(
          'No preference — your call | WordPress | Shopify | Custom-built | Wix / Squarespace | Other',
        ),
      },
    ],
  },
  {
    key: 'goals',
    title: 'Goals & success',
    blurb: 'What success looks like, must-haves, and the #1 action you want visitors to take.',
    questions: [
      {
        id: 'goals.success',
        type: 'checkbox',
        label: 'How will you measure success?',
        options: O(
          'More sales / orders | More enquiries / leads | More signups | More traffic / visits | Brand awareness | Showcasing work | Something else',
        ),
      },
      {
        id: 'goals.must_haves',
        type: 'textarea',
        label: 'Top 3 must-haves — what absolutely cannot be missing?',
        required: true,
      },
      {
        id: 'goals.cta',
        type: 'radio',
        label: 'What is the #1 action you want visitors to take?',
        options: O('Call us | Buy a product | Book an appointment | Send an enquiry | Sign up | View my work | Other'),
      },
      {
        id: 'goals.competitors',
        type: 'textarea',
        label: 'Who are your main competitors? (links if possible)',
      },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing & SEO',
    blurb: 'Google visibility, social links and how the site will be promoted.',
    questions: [
      {
        id: 'marketing.seo',
        type: 'radio',
        label: 'How important is being found on Google?',
        options: O('Very important | Somewhat important | Not important'),
      },
      {
        id: 'marketing.seo_help',
        type: 'radio',
        label: 'Do you want help with SEO setup (titles, descriptions, sitemap)?',
        options: O("Yes, please handle it | I'll handle it | Not sure"),
      },
      {
        id: 'marketing.social',
        type: 'checkbox',
        label: 'Which social channels should be linked?',
        options: O(
          'Facebook | Instagram | LinkedIn | X / Twitter | YouTube | TikTok | Pinterest | None',
        ),
      },
      {
        id: 'marketing.ads',
        type: 'radio',
        label: 'Will you run paid ads to this site?',
        options: O('Yes — Google Ads | Yes — social ads | Maybe later | No'),
      },
    ],
  },
  {
    key: 'extra',
    title: 'Anything else',
    blurb: "Final notes and how they'd like to be contacted.",
    questions: [
      {
        id: 'extra.comments',
        type: 'textarea',
        label: 'Anything else we should know about this project?',
      },
      {
        id: 'extra.contact_pref',
        type: 'radio',
        label: 'How would you like us to contact you?',
        options: O('Email | Phone | WhatsApp | Video call'),
      },
    ],
  },
];

export const ALL_QUESTIONS: Question[] = MODULES.flatMap((m) => m.questions);
export const QUESTION_COUNT = ALL_QUESTIONS.length;
export const MODULE_COUNT = MODULES.length;
export const REQUIRED_QUESTIONS = ALL_QUESTIONS.filter((q) => q.required);

export type AnswerValue = string | string[] | number;
export type Answers = Record<string, AnswerValue>;

export function findQuestion(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

/**
 * An answer counts as filled when it is not empty/zero-length.
 * Currency answers are stored as canonical INR strings; a legacy answer saved
 * by the previous radio-based question still counts as answered.
 */
export function isAnswered(q: Question, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return value.trim().length > 0;
}

export function moduleProgress(module: LibraryModule, answers: Answers) {
  const total = module.questions.length;
  const done = module.questions.filter((q) => isAnswered(q, answers[q.id])).length;
  return { done, total, complete: done === total };
}

export function overallProgress(answers: Answers) {
  const done = ALL_QUESTIONS.filter((q) => isAnswered(q, answers[q.id])).length;
  return { done, total: QUESTION_COUNT, percent: Math.round((done / QUESTION_COUNT) * 100) };
}

export function missingRequired(answers: Answers): Question[] {
  return REQUIRED_QUESTIONS.filter((q) => !isAnswered(q, answers[q.id]));
}
