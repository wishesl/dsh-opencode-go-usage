/**
 * Unit tests for the live model-selection probe.
 * @module @sutong12/dsh-opencode-go-usage/model-provider.test
 */

import { describe, expect, it, vi } from 'vitest'
import { createProviderProbe, type ServiceLookup } from './client/model-provider.ts'

/** A store stub whose snapshot and subscribers the test drives. */
function makeStore(initial: { current?: unknown; pending?: unknown }) {
  const listeners = new Set<() => void>()
  let state = initial
  return {
    store: {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    /** Replace the state and notify, as a real selection change would. */
    set(next: { current?: unknown; pending?: unknown }) {
      state = next
      for (const listener of [...listeners]) listener()
    },
    listenerCount: () => listeners.size,
  }
}

/** A context whose `modelDirectories` resolves to the given directory. */
function lookupOf(directoryFor: (sessionId: string) => unknown): ServiceLookup {
  return {
    get: (key: string) => (key === 'modelDirectories' ? { directoryFor } : undefined),
  }
}

describe('createProviderProbe', () => {
  it('reads the saved selection of the requested session', () => {
    const fake = makeStore({ current: { provider: 'opencode-go' } })
    const probe = createProviderProbe(lookupOf(() => ({ store: fake.store })), 'session-1')
    expect(probe.read()).toBe('opencode-go')
  })

  it('passes the session id through to the resolver', () => {
    const directoryFor = vi.fn(() => ({ store: makeStore({}).store }))
    createProviderProbe(lookupOf(directoryFor), 'session-42').read()
    expect(directoryFor).toHaveBeenCalledWith('session-42')
  })

  it('prefers pending so a switch registers on the click', () => {
    const fake = makeStore({ current: { provider: 'deepseek-account' }, pending: { provider: 'opencode-go' } })
    const probe = createProviderProbe(lookupOf(() => ({ store: fake.store })), 'session-1')
    expect(probe.read()).toBe('opencode-go')
  })

  it('answers unknown while the service is missing', () => {
    const probe = createProviderProbe({ get: () => undefined }, 'session-1')
    expect(probe.read()).toBeUndefined()
    expect(probe.subscribe(() => {})).toBeTypeOf('function')
  })

  it('answers unknown when the resolver rejects the session', () => {
    const probe = createProviderProbe(lookupOf(() => {
      throw new Error('unknown session')
    }), 'session-1')
    expect(probe.read()).toBeUndefined()
  })

  it('answers unknown for a malformed or empty selection', () => {
    const blank = makeStore({ current: null })
    expect(createProviderProbe(lookupOf(() => ({ store: blank.store })), 's').read()).toBeUndefined()
    const wrongType = makeStore({ current: { provider: 42 } })
    expect(createProviderProbe(lookupOf(() => ({ store: wrongType.store })), 's').read()).toBeUndefined()
    const empty = makeStore({ current: { provider: '' } })
    expect(createProviderProbe(lookupOf(() => ({ store: empty.store })), 's').read()).toBeUndefined()
  })

  it('notifies subscribers on every selection change', () => {
    const fake = makeStore({ current: { provider: 'deepseek-account' } })
    const probe = createProviderProbe(lookupOf(() => ({ store: fake.store })), 'session-1')
    const seen: Array<string | undefined> = []
    const dispose = probe.subscribe(() => { seen.push(probe.read()) })

    fake.set({ current: { provider: 'opencode-go' } })
    fake.set({ current: { provider: 'deepseek-account' } })
    dispose()
    fake.set({ current: { provider: 'opencode-go' } })

    expect(seen).toEqual(['opencode-go', 'deepseek-account'])
    expect(fake.listenerCount()).toBe(0)
  })

  it('subscribes to nothing when the service is missing', () => {
    const probe = createProviderProbe({ get: () => undefined }, 'session-1')
    const dispose = probe.subscribe(() => { throw new Error('must never fire') })
    expect(dispose).toBeTypeOf('function')
  })
})
