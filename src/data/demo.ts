/* ------------------------------------------------------------------
   DEMO DATA
   Sample workspace used when no backend is configured (VITE_API_URL
   unset). Everything here is illustrative and surfaced in the UI
   with a "Demo data" marker — nothing below is real usage.
   ------------------------------------------------------------------ */
import type {
  Agent, Asset, Avatar, KnowledgeSource, LiveSession, UsagePoint, User, Video, Voice, Workspace, WorkflowNode,
} from '@/types'

const now = Date.now()
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString()
const days = (d: number) => ago(d * 24 * 60)

export const demoUser: User = {
  id: 'u_1',
  name: 'Shalya Kumar',
  email: 'shalya@rooman.com',
  role: 'Owner',
}

export const demoWorkspace: Workspace = {
  id: 'ws_1',
  name: 'Rooman Studio',
  plan: 'Pro',
  credits: { used: 6240, total: 10000 },
  storage: { usedBytes: 38.4 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 },
}

export const demoVoices: Voice[] = [
  { id: 'v_shalya', name: 'Shalya Voice', avatarId: 'av_shalya', kind: 'cloned', language: 'English', tone: 'Warm, confident' },
  { id: 'v_aria', name: 'Aria Voice', avatarId: 'av_aria', kind: 'cloned', language: 'English', tone: 'Friendly, clear' },
  { id: 'v_dev', name: 'Dev Voice', avatarId: 'av_dev', kind: 'cloned', language: 'Hindi', tone: 'Calm, measured' },
  { id: 'v_studio', name: 'Studio Narrator', kind: 'stock', language: 'English', tone: 'Neutral, polished' },
  { id: 'v_nova', name: 'Nova', kind: 'stock', language: 'English', tone: 'Bright, energetic' },
]

export const demoAvatars: Avatar[] = [
  {
    id: 'av_shalya',
    name: 'Shalya',
    kind: 'Digital Twin',
    status: 'ready',
    voiceId: 'v_shalya',
    createdAt: days(42),
    hue: 258,
    primary: true,
    usage: { videos: 14, agents: 3, liveSessions: 28 },
    languages: ['English', 'Hindi', 'Kannada'],
  },
  {
    id: 'av_aria',
    name: 'Aria',
    kind: 'Brand Presenter',
    status: 'ready',
    voiceId: 'v_aria',
    createdAt: days(21),
    hue: 212,
    usage: { videos: 6, agents: 1, liveSessions: 9 },
    languages: ['English', 'Spanish'],
  },
  {
    id: 'av_dev',
    name: 'Dev',
    kind: 'Digital Twin',
    status: 'training',
    voiceId: 'v_dev',
    createdAt: ago(38),
    hue: 168,
    trainingProgress: 64,
    usage: { videos: 0, agents: 0, liveSessions: 0 },
    languages: ['Hindi', 'English'],
  },
]

export const demoVideos: Video[] = [
  { id: 'vid_1', title: 'Product Introduction', avatarId: 'av_shalya', voiceId: 'v_shalya', prompt: 'Introduce our AI platform to new enterprise customers.', action: 'talk', scene: 'studio', aspect: '16:9', language: 'English', durationSec: 94, status: 'ready', createdAt: ago(95), consistencyVerified: true },
  { id: 'vid_2', title: 'Welcome Video', avatarId: 'av_shalya', voiceId: 'v_shalya', prompt: 'Welcome new customers and explain the first three steps.', action: 'greeting', scene: 'office', aspect: '16:9', language: 'English', durationSec: 48, status: 'ready', createdAt: days(1), consistencyVerified: true },
  { id: 'vid_3', title: 'Recruitment Campaign', avatarId: 'av_shalya', voiceId: 'v_shalya', prompt: 'Walk toward the camera and invite engineers to join the team.', action: 'walk', scene: 'office', aspect: '9:16', language: 'English', durationSec: 32, status: 'generating', progress: 58, createdAt: ago(6) },
  { id: 'vid_4', title: 'Company Overview', avatarId: 'av_aria', voiceId: 'v_aria', prompt: 'Explain what the company does in under a minute.', action: 'demonstrate', scene: 'studio', aspect: '16:9', language: 'English', durationSec: 71, status: 'ready', createdAt: days(3), consistencyVerified: true },
  { id: 'vid_5', title: 'Onboarding — Week 1', avatarId: 'av_shalya', voiceId: 'v_shalya', prompt: 'Guide new hires through week one.', action: 'talk', scene: 'studio', aspect: '1:1', language: 'Hindi', durationSec: 126, status: 'ready', createdAt: days(5), consistencyVerified: true },
  { id: 'vid_6', title: 'Quarterly Update', avatarId: 'av_aria', voiceId: 'v_aria', prompt: 'Summarise Q3 results for the partner network.', action: 'talk', scene: 'custom', aspect: '16:9', language: 'English', durationSec: 0, status: 'failed', createdAt: days(6) },
  { id: 'vid_7', title: 'Feature Walkthrough', avatarId: 'av_shalya', voiceId: 'v_shalya', prompt: 'Demonstrate the new analytics dashboard.', action: 'demonstrate', scene: 'office', aspect: '16:9', language: 'English', durationSec: 83, status: 'ready', createdAt: days(9), consistencyVerified: true },
  { id: 'vid_8', title: 'Festive Greeting', avatarId: 'av_shalya', voiceId: 'v_shalya', prompt: 'Wish our customers a happy festive season.', action: 'greeting', scene: 'custom', aspect: '9:16', language: 'Kannada', durationSec: 22, status: 'ready', createdAt: days(12), consistencyVerified: true },
]

export const demoLiveSessions: LiveSession[] = [
  { id: 'ls_1', avatarId: 'av_shalya', title: 'Product Q&A rehearsal', durationSec: 812, messages: 34, createdAt: ago(240) },
  { id: 'ls_2', avatarId: 'av_shalya', agentId: 'ag_hr', title: 'HR placement test call', durationSec: 426, messages: 18, createdAt: days(1) },
  { id: 'ls_3', avatarId: 'av_aria', title: 'Customer greeting practice', durationSec: 305, messages: 12, createdAt: days(2) },
]

const hrKnowledge: KnowledgeSource[] = [
  { id: 'k_1', name: 'Placement Process Handbook.pdf', type: 'pdf', sizeBytes: 2_480_000, status: 'ready', chunks: 186, updatedAt: days(4) },
  { id: 'k_2', name: 'Open Roles — Q4.xlsx', type: 'xlsx', sizeBytes: 412_000, status: 'ready', chunks: 64, updatedAt: days(1) },
  { id: 'k_3', name: 'Candidate Pool Export.csv', type: 'csv', sizeBytes: 1_920_000, status: 'processing', chunks: 0, progress: 42, updatedAt: ago(12) },
  { id: 'k_4', name: 'Salary Bands 2026.docx', type: 'docx', sizeBytes: 188_000, status: 'ready', chunks: 22, updatedAt: days(8) },
  { id: 'k_5', name: 'rooman.com/careers', type: 'url', sizeBytes: 0, status: 'ready', chunks: 41, updatedAt: days(2) },
]

const hrWorkflow: WorkflowNode[] = [
  { id: 'w1', label: 'Start', kind: 'start', description: 'Inbound call or web session from an HR team' },
  { id: 'w2', label: 'Understand HR requirement', kind: 'step', description: 'Identify the role, urgency and hiring manager' },
  { id: 'w3', label: 'Collect job details', kind: 'step', description: 'Skills, experience, location, budget' },
  { id: 'w4', label: 'Search candidate knowledge', kind: 'tool', description: 'Query the candidate pool and open roles' },
  { id: 'w5', label: 'Check candidate match', kind: 'decision', description: 'Score shortlisted candidates against requirements' },
  { id: 'w6', label: 'Communicate result', kind: 'step', description: 'Share shortlist and next steps with the HR team' },
  { id: 'w7', label: 'Complete placement / Human handoff', kind: 'handoff', description: 'Schedule interviews or route to a recruiter' },
]

const baseTools = (on: string[]) =>
  [
    { id: 't_kb', name: 'Knowledge search', description: 'Look up answers in connected documents' },
    { id: 't_cal', name: 'Calendar', description: 'Check availability and schedule meetings' },
    { id: 't_crm', name: 'CRM', description: 'Read and update contact records' },
    { id: 't_email', name: 'Email', description: 'Send follow-ups and summaries' },
    { id: 't_ats', name: 'Applicant tracking', description: 'Search candidates and update pipeline stages' },
    { id: 't_handoff', name: 'Human handoff', description: 'Transfer to a person when needed' },
  ].map((t) => ({ ...t, enabled: on.includes(t.id) }))

export const demoAgents: Agent[] = [
  {
    id: 'ag_hr',
    name: 'HR Placement Agent',
    status: 'live',
    avatarId: 'av_shalya',
    voiceId: 'v_shalya',
    purpose: 'Receives HR inquiries and helps complete candidate placement workflows.',
    caller: 'HR teams and hiring managers at client companies',
    goals: ['Capture complete job requirements', 'Shortlist matching candidates', 'Schedule interviews or hand off to a recruiter'],
    personality: 'Professional, warm, concise. Asks one question at a time.',
    guardrails: ['Never share candidate personal contact details', 'Do not commit to salary figures', 'Escalate legal or compliance questions to a human'],
    languages: ['English', 'Hindi'],
    channels: ['phone', 'web', 'api'],
    tools: baseTools(['t_kb', 't_cal', 't_ats', 't_email', 't_handoff']),
    knowledge: hrKnowledge,
    workflow: hrWorkflow,
    stats: { conversations: 284, completionRate: 91, activeToday: 18, avgDurationSec: 312 },
    createdAt: days(30),
    updatedAt: days(1),
    activity: [
      { id: 'a1', kind: 'conversation', text: 'Completed placement intake with Nimbus Labs', at: ago(14) },
      { id: 'a2', kind: 'handoff', text: 'Handed off a compliance question to Priya (Recruiter)', at: ago(52) },
      { id: 'a3', kind: 'conversation', text: 'Shortlisted 4 candidates for Senior Data Engineer', at: ago(130) },
      { id: 'a4', kind: 'edit', text: 'Knowledge updated: Open Roles — Q4.xlsx', at: days(1) },
      { id: 'a5', kind: 'deploy', text: 'Deployed v1.4 to Phone and Web', at: days(2) },
    ],
  },
  {
    id: 'ag_sales',
    name: 'Sales Agent',
    status: 'live',
    avatarId: 'av_shalya',
    voiceId: 'v_shalya',
    purpose: 'Qualifies inbound leads, answers product questions and books demos.',
    caller: 'Prospective customers from the website and campaigns',
    goals: ['Qualify budget, authority, need and timeline', 'Answer product questions accurately', 'Book a demo with the right account executive'],
    personality: 'Energetic, consultative, never pushy.',
    guardrails: ['Do not offer discounts', 'Do not make roadmap promises'],
    languages: ['English'],
    channels: ['web', 'video', 'whatsapp'],
    tools: baseTools(['t_kb', 't_cal', 't_crm', 't_email']),
    knowledge: hrKnowledge.slice(0, 1).map((k) => ({ ...k, id: 'k_s1', name: 'Product Brochure 2026.pdf', chunks: 94 })),
    workflow: [
      { id: 's1', label: 'Start', kind: 'start' },
      { id: 's2', label: 'Greet & discover need', kind: 'step' },
      { id: 's3', label: 'Qualify lead', kind: 'decision' },
      { id: 's4', label: 'Answer product questions', kind: 'tool' },
      { id: 's5', label: 'Book demo', kind: 'end' },
    ],
    stats: { conversations: 1_126, completionRate: 74, activeToday: 42, avgDurationSec: 204 },
    createdAt: days(18),
    updatedAt: days(3),
    activity: [
      { id: 'b1', kind: 'conversation', text: 'Booked a demo with Arcadia Retail', at: ago(22) },
      { id: 'b2', kind: 'conversation', text: 'Qualified 12 new leads from the webinar campaign', at: ago(300) },
    ],
  },
  {
    id: 'ag_support',
    name: 'Customer Support Agent',
    status: 'paused',
    avatarId: 'av_aria',
    voiceId: 'v_aria',
    purpose: 'Resolves tier-1 support questions over video chat and escalates the rest.',
    caller: 'Existing customers',
    goals: ['Resolve common issues on first contact', 'Collect diagnostics', 'Escalate with full context'],
    personality: 'Patient, clear, reassuring.',
    guardrails: ['Never ask for passwords', 'Escalate billing disputes'],
    languages: ['English', 'Spanish'],
    channels: ['web', 'video'],
    tools: baseTools(['t_kb', 't_crm', 't_handoff']),
    knowledge: [],
    workflow: [
      { id: 'c1', label: 'Start', kind: 'start' },
      { id: 'c2', label: 'Identify issue', kind: 'step' },
      { id: 'c3', label: 'Search help center', kind: 'tool' },
      { id: 'c4', label: 'Resolved?', kind: 'decision' },
      { id: 'c5', label: 'Escalate to support team', kind: 'handoff' },
    ],
    stats: { conversations: 642, completionRate: 83, activeToday: 0, avgDurationSec: 268 },
    createdAt: days(40),
    updatedAt: days(6),
    activity: [{ id: 'c_a1', kind: 'edit', text: 'Paused for knowledge refresh', at: days(6) }],
  },
  {
    id: 'ag_recruit',
    name: 'Recruitment Agent',
    status: 'draft',
    avatarId: 'av_shalya',
    voiceId: 'v_shalya',
    purpose: 'Screens applicants with a short video interview and ranks them for recruiters.',
    caller: 'Job applicants',
    goals: ['Run a structured 10-minute screen', 'Score answers against the rubric', 'Share a ranked summary with recruiters'],
    personality: 'Encouraging, fair, structured.',
    guardrails: ['Ask only role-relevant questions', 'Never discuss protected characteristics'],
    languages: ['English', 'Hindi'],
    channels: ['video', 'web'],
    tools: baseTools(['t_kb', 't_ats', 't_email']),
    knowledge: [],
    workflow: [
      { id: 'r1', label: 'Start', kind: 'start' },
      { id: 'r2', label: 'Introduce the role', kind: 'step' },
      { id: 'r3', label: 'Screening questions', kind: 'step' },
      { id: 'r4', label: 'Score responses', kind: 'tool' },
      { id: 'r5', label: 'Send summary', kind: 'end' },
    ],
    stats: { conversations: 0, completionRate: 0, activeToday: 0, avgDurationSec: 0 },
    createdAt: days(2),
    updatedAt: days(2),
    activity: [{ id: 'r_a1', kind: 'edit', text: 'Draft created from Agent Builder', at: days(2) }],
  },
]

export const demoAssets: Asset[] = [
  ...demoVideos.filter((v) => v.status === 'ready').map<Asset>((v) => ({
    id: `as_${v.id}`, name: `${v.title}.mp4`, kind: 'video', sizeBytes: v.durationSec * 1_400_000, createdAt: v.createdAt, avatarId: v.avatarId, durationSec: v.durationSec,
  })),
  { id: 'as_ref1', name: 'Shalya — reference take 02.mov', kind: 'video', sizeBytes: 486_000_000, createdAt: days(42), avatarId: 'av_shalya', durationSec: 184 },
  { id: 'as_au1', name: 'Shalya Voice — sample.wav', kind: 'audio', sizeBytes: 5_200_000, createdAt: days(42), avatarId: 'av_shalya', durationSec: 32 },
  { id: 'as_au2', name: 'Aria Voice — sample.wav', kind: 'audio', sizeBytes: 4_100_000, createdAt: days(21), avatarId: 'av_aria', durationSec: 28 },
  { id: 'as_au3', name: 'Brand sting.mp3', kind: 'audio', sizeBytes: 820_000, createdAt: days(14), durationSec: 6 },
  ...demoAvatars.map<Asset>((a) => ({ id: `as_${a.id}`, name: `${a.name} — ${a.kind}`, kind: 'avatar', sizeBytes: 1_200_000_000, createdAt: a.createdAt, avatarId: a.id, hue: a.hue })),
  ...hrKnowledge.filter((k) => k.type !== 'url').map<Asset>((k) => ({ id: `as_${k.id}`, name: k.name, kind: 'document', sizeBytes: k.sizeBytes, createdAt: k.updatedAt })),
  { id: 'as_img1', name: 'Office backdrop.png', kind: 'image', sizeBytes: 3_400_000, createdAt: days(10), hue: 230 },
  { id: 'as_img2', name: 'Studio backdrop — dusk.png', kind: 'image', sizeBytes: 2_900_000, createdAt: days(16), hue: 280 },
  { id: 'as_img3', name: 'Logo lockup.svg', kind: 'image', sizeBytes: 24_000, createdAt: days(40), hue: 250 },
]

export const demoUsage: UsagePoint[] = [
  { label: 'Apr', videos: 18, liveMinutes: 140, agentConversations: 220 },
  { label: 'May', videos: 26, liveMinutes: 210, agentConversations: 410 },
  { label: 'Jun', videos: 31, liveMinutes: 260, agentConversations: 590 },
  { label: 'Jul', videos: 29, liveMinutes: 330, agentConversations: 780 },
  { label: 'Aug', videos: 42, liveMinutes: 410, agentConversations: 1010 },
  { label: 'Sep', videos: 48, liveMinutes: 486, agentConversations: 1240 },
]
