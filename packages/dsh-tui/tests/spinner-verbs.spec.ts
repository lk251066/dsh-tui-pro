import { describe, expect, it } from 'vitest'
import { pickSpinnerVerb, SPINNER_VERBS } from '../src/chat/spinner-verbs.ts'

describe('spinner verbs', () => {
  it('ships a full table of single capitalized words', () => {
    expect(SPINNER_VERBS.length).toBeGreaterThanOrEqual(40)
    for (const verb of SPINNER_VERBS) {
      // Capitalized, one word, no ellipsis or other punctuation: the caller
      // appends the ellipsis, so the table must stay bare.
      expect(verb).toMatch(/^[A-Z][a-z]+$/u)
    }
  })

  it('holds no duplicates', () => {
    expect(new Set(SPINNER_VERBS).size).toBe(SPINNER_VERBS.length)
  })

  it('picks deterministically: the same seed always yields the same verb', () => {
    for (const seed of [0, 1, 7, 42, 4242]) {
      expect(pickSpinnerVerb(seed)).toBe(pickSpinnerVerb(seed))
      expect(pickSpinnerVerb(seed)).toBe(SPINNER_VERBS[seed % SPINNER_VERBS.length])
    }
  })

  it('folds negative seeds onto their absolute value', () => {
    expect(pickSpinnerVerb(-7)).toBe(pickSpinnerVerb(7))
    expect(pickSpinnerVerb(-7)).toBe(SPINNER_VERBS[7 % SPINNER_VERBS.length])
  })

  it('consecutive seeds cover the whole table', () => {
    const picked = Array.from({ length: SPINNER_VERBS.length }, (_, seed) => pickSpinnerVerb(seed))
    expect(new Set(picked).size).toBe(SPINNER_VERBS.length)
    for (const verb of SPINNER_VERBS) expect(picked).toContain(verb)
  })
})
