/* Landing-page copy and data for Rooman Agent.
 *
 * Product copy describes what the platform does (avatar engine, agent builder, live
 * conversations, workspace). It makes no performance, compliance or customer claims —
 * add those only once they can be backed up.
 *
 * Rooman figures come from https://www.rooman.net/ (stats band + FAQ, checked 2026-10-05).
 * Older figures (24+ years, 500+ tie-ups, 10+ lakh students) were superseded by that page.
 */

const EXTERNAL = 'https://www.rooman.net'

/** The three-step product story, used in the hero strip and the nav. */
export const STEPS = [
  { id: 'avatar', title: 'Create your avatar', body: 'Upload a short video of yourself.' },
  { id: 'agent', title: 'Build an agent', body: 'Describe it out loud. We write the spec.' },
  { id: 'live', title: 'Go live', body: 'It talks with your face and voice.' },
] as const

/** 01 — Avatar engine pipeline. */
export const AVATAR_PIPELINE = [
  {
    title: 'Ingest',
    body: 'We find your face and body, remove the background and pull out clean audio from your video.',
  },
  {
    title: 'Train',
    body: 'Everything is packaged into one reusable digital twin, with your voice cloned alongside it.',
  },
  {
    title: 'Generate',
    body: 'Give it a script or an audio clip, and it makes a video of you talking, greeting or demonstrating.',
  },
  {
    title: 'Check',
    body: 'Every generated frame is compared with your original face. Frames that drift are flagged or rejected.',
  },
] as const

/** 02 — What the agent builder listens for. */
export const BUILDER_SLOTS = [
  ['Purpose', 'What the agent is for'],
  ['Callers', 'Who will talk to it'],
  ['Workflow', 'What it should do, step by step'],
  ['Tools', 'What it needs to connect to'],
  ['Language', 'How it should speak'],
] as const

/** Illustrative builder exchange — labelled as an example on the page, not a customer quote. */
export const BUILDER_EXAMPLE = [
  { who: 'You', text: 'I need a receptionist for our office. It should answer questions about our services and book meetings.' },
  { who: 'Builder', text: 'Got it. Who will be calling — customers, partners, or both? And which language should it use?' },
  { who: 'You', text: 'Mostly customers, and in English.' },
] as const

/** 04 — Use cases. */
export const USE_CASES = [
  {
    title: 'Receptionist',
    body: 'Greets visitors, answers common questions and books appointments.',
    photo: 'boardroom',
  },
  {
    title: 'Sales representative',
    body: 'Walks prospects through your offer in your own face and voice, and hands warm leads to your team.',
    photo: 'presenting',
  },
  {
    title: 'Trainer',
    body: 'Delivers lessons and demonstrations as video, then answers learners’ questions from your material.',
    photo: 'classroom',
  },
  {
    title: 'Support agent',
    body: 'Answers from your documents, follows your workflow and knows when to escalate to a person.',
    photo: 'engineer',
  },
] as const

/** 05 — Workspace. */
export const WORKSPACE = [
  ['Avatars', 'Record or upload a video, watch your twin being created, and request new actions.'],
  ['Agent builder', 'Talk to the builder by voice or chat, review the spec, and pick an avatar for it.'],
  ['Dashboard', 'Every agent you have built, and its status, in one list.'],
  ['Usage', 'Render-minutes and conversation-minutes, so you can plan capacity and cost.'],
] as const

/** 06 — Built by Rooman. rooman.net stats band + FAQ, 2026. */
export const FIGURES = [
  { value: '27', unit: 'yrs', label: 'Training people in technology, since 1999' },
  { value: '1.3', unit: 'M+', label: 'Students trained' },
  { value: '198', unit: '+', label: 'Training centres in India' },
  { value: '1,000', unit: '+', label: 'Hiring partners' },
] as const

export const FIGURES_SOURCE = 'Rooman Technologies figures: rooman.net, 2026'

/** 07 — Product FAQ, limited to what the platform actually does. */
export const FAQ = [
  {
    q: 'What do I need to create an avatar?',
    a: 'A video of yourself, recorded in the browser or uploaded. You confirm consent before anything is trained. The engine takes it from there: it isolates your face, body and voice and builds your digital twin.',
  },
  {
    q: 'What can my avatar do?',
    a: 'Give it a script or an audio clip and it generates a video of you saying it — talking, greeting or demonstrating. Agents can also use your avatar to hold live conversations.',
  },
  {
    q: 'How do you stop my avatar from looking like someone else?',
    a: 'Every generated frame is compared with your original face. Frames where the face has drifted are flagged or rejected, so your twin stays you.',
  },
  {
    q: 'How do I build an agent?',
    a: 'Just talk. The builder asks about the agent’s purpose, who will call it, its workflow, the tools it needs and its language, then turns that into a conversation flow and a ready-to-deploy agent spec.',
  },
  {
    q: 'Can my agent answer from my own documents?',
    a: 'Yes. Upload your reference documents while you build the agent, and it answers from them during conversations.',
  },
] as const

export const LINKS = {
  external: EXTERNAL,
  about: `${EXTERNAL}/about`,
  careers: `${EXTERNAL}/careers`,
  privacy: `${EXTERNAL}/privacy`,
  terms: `${EXTERNAL}/terms`,
} as const

export const CONTACT = {
  email: 'hello@rooman.com',
  phone: '080 6945 1000',
  address: ['Rooman Technologies Pvt Ltd', '#30, 12th Main, 1st Stage, Rajajinagar', 'Bengaluru – 560 010, Karnataka, India'],
} as const

/* Documentary photography, self-hosted from Unsplash (free licence). Credits: public/images/landing/CREDITS.md. */
export const PHOTOS = {
  classroom: { w: 4624, h: 3472, alt: 'Students at their desks listening during a classroom session' },
  presenting: { w: 5760, h: 3240, alt: 'A woman presenting to colleagues around a meeting table' },
  cohort: { w: 6000, h: 4000, alt: 'A group of people laughing together around a table' },
  engineer: { w: 4000, h: 6000, alt: 'A young engineer working at a desktop computer' },
  boardroom: { w: 6000, h: 4000, alt: 'Professionals in a meeting room watching a presentation' },
  graduate: { w: 4000, h: 6000, alt: 'A smiling young woman among a crowd at an event' },
  learner: { w: 3088, h: 2056, alt: 'A young man smiling with a laptop on his lap' },
} as const

export type PhotoKey = keyof typeof PHOTOS
