/**
 * Multi-session channel registry: tracks one slot per live in-process session,
 * swaps the mounted slot under the shared chrome, and bounds the live set with
 * an idle-only LRU. The registry owns bookkeeping only — building a slot's
 * components, wiring them into the chrome, and refreshing the chrome on a
 * switch all live in host callbacks, so the module stays independent of the
 * TUI component tree (and unit-testable without a terminal).
 *
 * Sessions live with the process by design: nothing here persists or resumes;
 * `/sessions` remains the door for logs from previous runs.
 * @module @deepseek-ai/dsh-tui/chat/channel-registry
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'

/**
 * One live session's per-session state. Hosts extend this with their channel
 * and per-session controllers (docks, approval answerer, scoped listeners).
 */
export interface SessionSlot {
  /** The session the slot renders (its agent's `session.id`). */
  readonly sessionId: SessionId
  /** The agent driving the session. */
  readonly agent: Agent
}

/**
 * Chrome-facing operations the registry drives. Every callback is synchronous;
 * slot building itself is synchronous too (agents are created by the caller
 * before `adopt`).
 */
export interface ChannelRegistryHost<S extends SessionSlot> {
  /** Build one slot's components and scoped controllers for a live agent. */
  buildSlot(agent: Agent): S
  /** Wire one slot into the shared chrome and start its channel listeners. */
  mount(slot: S): void
  /** Unwire one slot from the chrome and stop its channel listeners. */
  unmount(slot: S): void
  /** Final teardown for an evicted slot (scoped listeners, overlays). */
  dispose(slot: S): void
  /** Chrome refresh after the active slot changed (status, prompt, header). */
  onActiveChange(previous: S | undefined, next: S): void
  /** Live-slot ceiling; only idle non-active slots ever count toward eviction. */
  readonly maxLiveSlots: number
  /** Report the eviction ceiling being unreachable (every victim busy). */
  onEvictionSkipped(liveCount: number): void
}

/** The multi-session registry as seen by the host chrome. */
export interface ChannelRegistry<S extends SessionSlot> {
  /** The mounted slot. */
  active(): S
  /** The mounted slot's session id. */
  activeId(): SessionId
  /** Look one live slot up by session id. */
  get(sessionId: SessionId): S | undefined
  /** Live slots in least-recently-used-first order. */
  slots(): readonly S[]
  /** Whether the slot is the mounted one. */
  isActive(slot: S): boolean
  /**
   * Switch the mounted slot. Unknown ids and the already-active slot are
   * no-ops that still report success (the requested state already holds).
   */
  switchTo(sessionId: SessionId): boolean
  /**
   * Register a freshly created agent as a new slot and switch to it. The
   * idle-only LRU evicts first when the ceiling would be exceeded.
   */
  adopt(agent: Agent, activate?: boolean): S
  /** Tear down every live slot (shutdown path). */
  disposeAll(): void
}

/** Live slots kept beyond the active one before idle eviction kicks in. */
export const DEFAULT_MAX_LIVE_SLOTS = 8

/**
 * Build the multi-session registry over one initial agent.
 * @param host - chrome-facing slot operations.
 * @param initial - the agent the TUI starts mounted on.
 * @returns the registry; the initial slot is already built, mounted, and
 * announced through `onActiveChange`.
 */
export function createChannelRegistry<S extends SessionSlot>(
  host: ChannelRegistryHost<S>,
  initial: Agent,
): ChannelRegistry<S> {
  // Map iteration order is insertion order; switches re-insert to move a slot
  // to the end, so the order is least-recently-used first.
  const slots = new Map<SessionId, S>()
  let activeSlot: S | undefined

  /** Move one slot to the most-recently-used end. */
  const touch = (slot: S): void => {
    slots.delete(slot.sessionId)
    slots.set(slot.sessionId, slot)
  }

  const switchTo = (sessionId: SessionId): boolean => {
    const next = slots.get(sessionId)
    if (next === undefined) return false
    if (next === activeSlot) return true
    const previous = activeSlot
    if (previous !== undefined) host.unmount(previous)
    activeSlot = next
    touch(next)
    host.mount(next)
    host.onActiveChange(previous, next)
    return true
  }

  /**
   * Evict idle non-active slots until the live set fits the ceiling. A set
   * with no idle victim keeps every slot (running sessions are never dropped)
   * and the host is told once.
   */
  const evictToCeiling = (): void => {
    while (slots.size > host.maxLiveSlots) {
      const victim = [...slots.values()].find(candidate =>
        candidate !== activeSlot && candidate.agent.status === 'idle')
      if (victim === undefined) {
        host.onEvictionSkipped(slots.size)
        return
      }
      slots.delete(victim.sessionId)
      host.dispose(victim)
    }
  }

  const initialSlot = host.buildSlot(initial)
  slots.set(initialSlot.sessionId, initialSlot)
  activeSlot = initialSlot
  host.mount(initialSlot)
  host.onActiveChange(undefined, initialSlot)

  return {
    active(): S {
      /* v8 ignore next -- activeSlot is assigned in every construction path before any read. */
      return activeSlot as S
    },
    activeId(): SessionId {
      return this.active().sessionId
    },
    get: sessionId => slots.get(sessionId),
    slots: () => [...slots.values()],
    isActive: slot => slot === activeSlot,
    switchTo,
    adopt(agent: Agent, activate = true): S {
      const slot = host.buildSlot(agent)
      slots.set(slot.sessionId, slot)
      // Switch first, evict after: the freshly adopted slot is momentarily the
      // newest idle one, and an eviction pass run before the switch would
      // select it as its own victim.
      if (activate) switchTo(slot.sessionId)
      evictToCeiling()
      return slot
    },
    disposeAll(): void {
      for (const slot of slots.values()) host.dispose(slot)
      if (activeSlot !== undefined) host.unmount(activeSlot)
      slots.clear()
      activeSlot = undefined
    },
  }
}
