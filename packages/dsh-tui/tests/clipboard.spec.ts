import { describe, expect, it, vi } from 'vitest'
import { copyText } from '../src/clipboard.ts'

describe('copyText', () => {
  it('uses the system clipboard for a local terminal', async () => {
    const writeSystem = vi.fn<(_: string) => Promise<void>>().mockResolvedValue()
    const terminal = { write: vi.fn() }

    await expect(copyText('hello', terminal, { env: {}, writeSystem })).resolves.toBe('system')
    expect(writeSystem).toHaveBeenCalledWith('hello')
    expect(terminal.write).not.toHaveBeenCalled()
  })

  it('uses tmux clipboard forwarding before terminal fallback', async () => {
    const writeTmux = vi.fn<(_: string) => Promise<void>>().mockResolvedValue()
    const terminal = { write: vi.fn() }

    await expect(copyText('中文', terminal, { env: { TMUX: '/tmp/tmux' }, writeTmux })).resolves.toBe('tmux')
    expect(writeTmux).toHaveBeenCalledWith('中文')
  })

  it('uses OSC 52 for SSH and preserves UTF-8 text', async () => {
    const terminal = { write: vi.fn() }

    await expect(copyText('中文\ntext', terminal, { env: { SSH_TTY: '/dev/pts/1' } })).resolves.toBe('terminal')
    const encoded = Buffer.from('中文\ntext', 'utf8').toString('base64')
    expect(terminal.write).toHaveBeenCalledWith(`\x1b]52;c;${encoded}\x07`)
  })

  it('falls back to OSC 52 when the local clipboard fails', async () => {
    const terminal = { write: vi.fn() }
    const writeSystem = vi.fn<(_: string) => Promise<void>>().mockRejectedValue(new Error('unavailable'))

    await expect(copyText('fallback', terminal, { env: {}, writeSystem })).resolves.toBe('terminal')
    expect(terminal.write).toHaveBeenCalledOnce()
  })

  it('rejects empty clipboard writes', async () => {
    await expect(copyText('', { write: vi.fn() }, { env: {} })).rejects.toThrow('Cannot copy empty text')
  })
})
