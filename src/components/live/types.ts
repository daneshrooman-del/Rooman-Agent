/* Shared types for live conversation building blocks. */

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'ended'

/** What is happening in the conversation right now. */
export type TurnPhase = 'idle' | 'listening' | 'thinking' | 'speaking'

export type Speaker = 'user' | 'avatar'

export type LiveEventKind = 'knowledge' | 'tool' | 'workflow' | 'response' | 'guardrail' | 'voice'

export interface LiveEvent {
  kind: LiveEventKind
  /** friendly name of the step, e.g. "Knowledge lookup" (defaults per kind) */
  label?: string
  /** what it touched, e.g. "Placement Process Handbook.pdf" */
  detail: string
}

export type TranscriptItem =
  | { id: string; type: 'message'; speaker: Speaker; text: string; streaming?: boolean; at: number }
  | ({ id: string; type: 'event'; at: number } & LiveEvent)

/** One scripted (or, later, real) reply: the steps taken, then what the avatar says. */
export interface LiveReply {
  events?: LiveEvent[]
  text: string
}

export interface ResponderMeta {
  /** set when a message comes from a quick-test scenario chip */
  scenario?: string
  /** true when the message was "spoken" rather than typed */
  spoken?: boolean
  turn: number
}

export type Responder = (input: string, meta: ResponderMeta) => LiveReply
