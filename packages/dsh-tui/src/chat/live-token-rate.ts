/**
 * Current-step output-rate tracking for the terminal status row.
 * @module @deepseek-ai/dsh-tui/chat/live-token-rate
 */

/** Recent output window used to smooth chunk-sized delivery bursts. */
export const LIVE_TOKEN_RATE_WINDOW_MS = 2_000

/** The same lightweight text-density estimate used by the live token counter. */
const CHARS_PER_TOKEN = 4

interface OutputSample {
  readonly at: number
  readonly characters: number
}

/**
 * Estimate the current model step's output speed from recent streamed text.
 * Exact provider usage arrives only when generation finishes, so live display
 * uses text density while the stream is open and never mixes earlier steps.
 */
export class LiveTokenRate {
  private active = false
  private firstOutputAt: number | undefined
  private readonly samples: OutputSample[] = []
  private sampleHead = 0
  private sampleCharacters = 0

  /** Open a new model step and discard the previous step's samples. */
  begin(): void {
    this.active = true
    this.firstOutputAt = undefined
    this.samples.length = 0
    this.sampleHead = 0
    this.sampleCharacters = 0
  }

  /** Close the current model step and remove its rate from the status row. */
  end(): void {
    this.active = false
    this.firstOutputAt = undefined
    this.samples.length = 0
    this.sampleHead = 0
    this.sampleCharacters = 0
  }

  /**
   * Record one streamed text or tool-argument delta.
   * @param text - Newly emitted output text.
   * @param at - Current render-clock time in epoch milliseconds.
   */
  record(text: string, at: number): void {
    if (text.length === 0) return
    if (!this.active) this.begin()
    const sampleAt = Math.max(this.samples.at(-1)?.at ?? at, at)
    this.firstOutputAt ??= sampleAt
    this.samples.push({ at: sampleAt, characters: text.length })
    this.sampleCharacters += text.length
    const cutoff = sampleAt - LIVE_TOKEN_RATE_WINDOW_MS
    this.prune(cutoff)
  }

  /**
   * Read the rolling current-step rate.
   * @param at - Current render-clock time in epoch milliseconds.
   * @returns Estimated tokens per second, or `undefined` before output begins
   * or after the step closes.
   */
  rate(at: number): number | undefined {
    if (!this.active || this.firstOutputAt === undefined) return undefined
    const windowStart = Math.max(this.firstOutputAt, at - LIVE_TOKEN_RATE_WINDOW_MS)
    this.prune(at - LIVE_TOKEN_RATE_WINDOW_MS)
    const elapsedMs = at - windowStart
    if (elapsedMs <= 0) return undefined
    return Math.round(this.sampleCharacters / CHARS_PER_TOKEN / (elapsedMs / 1_000))
  }

  private prune(cutoff: number): void {
    while (this.sampleHead < this.samples.length) {
      const sample = this.samples[this.sampleHead]
      if (sample === undefined || sample.at >= cutoff) break
      this.sampleCharacters -= sample.characters
      this.sampleHead += 1
    }
    if (this.sampleHead >= 128 && this.sampleHead * 2 >= this.samples.length) {
      this.samples.splice(0, this.sampleHead)
      this.sampleHead = 0
    }
  }
}
