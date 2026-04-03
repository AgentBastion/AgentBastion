import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to reset modules between tests because api.ts has module-level state
let apiModule: typeof import('./api')

const mockStorage: Record<string, string> = {}
const mockSessionStorage: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value },
  removeItem: (key: string) => { delete mockStorage[key] },
})

vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => mockSessionStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockSessionStorage[key] = value },
  removeItem: (key: string) => { delete mockSessionStorage[key] },
})

// Prevent navigation side effects
const originalLocation = window.location
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '/' },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: originalLocation,
  })
  // Clear storage
  for (const key of Object.keys(mockStorage)) delete mockStorage[key]
  for (const key of Object.keys(mockSessionStorage)) delete mockSessionStorage[key]
  vi.restoreAllMocks()
})

beforeEach(async () => {
  vi.resetModules()
  apiModule = await import('./api')
})

describe('api client', () => {
  it('sends GET request with auth header', async () => {
    mockStorage['access_token'] = 'test-token-123'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await apiModule.api('/api/test')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/test')
    expect(options.method).toBe('GET')
    expect(options.headers['Authorization']).toBe('Bearer test-token-123')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(result).toEqual({ data: 'test' })
  })

  it('sends POST with body and content-type', async () => {
    mockStorage['access_token'] = 'test-token'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '1' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const body = { name: 'test', value: 42 }
    await apiModule.api('/api/items', { method: 'POST', body })

    const [, options] = mockFetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe(JSON.stringify(body))
  })

  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: { message: 'Invalid input' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(apiModule.api('/api/bad')).rejects.toThrow('Invalid input')
  })

  it('attempts token refresh on 401', async () => {
    mockStorage['access_token'] = 'expired-token'
    mockStorage['refresh_token'] = 'valid-refresh-token'

    const mockFetch = vi.fn()
      // First call: 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Unauthorized' } }),
      })
      // Refresh call: success
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          signing_key: 'abc123',
        }),
      })
      // Retry call: success
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'refreshed' }),
      })

    vi.stubGlobal('fetch', mockFetch)

    const result = await apiModule.api('/api/protected')

    expect(mockFetch).toHaveBeenCalledTimes(3)
    // Verify refresh was called
    const [refreshUrl, refreshOpts] = mockFetch.mock.calls[1]
    expect(refreshUrl).toBe('/api/auth/refresh')
    expect(refreshOpts.method).toBe('POST')
    // Verify retry used new token
    const [, retryOpts] = mockFetch.mock.calls[2]
    expect(retryOpts.headers['Authorization']).toBe('Bearer new-access-token')
    expect(result).toEqual({ data: 'refreshed' })
    // Verify tokens were stored
    expect(mockStorage['access_token']).toBe('new-access-token')
    expect(mockStorage['refresh_token']).toBe('new-refresh-token')
  })
})
