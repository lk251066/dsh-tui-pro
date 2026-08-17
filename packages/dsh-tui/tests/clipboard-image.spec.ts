import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  ClipboardImageError,
  detectImageMediaType,
  readClipboardImage,
  runClipboardCommand,
  type ClipboardCommand,
  type ClipboardCommandResult,
  type ClipboardCommandRunner,
} from '../src/clipboard-image.ts'

const spawn = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ spawn }))

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0x00])
const GIF87 = Uint8Array.from(Buffer.from('GIF87a'))
const GIF89 = Uint8Array.from(Buffer.from('GIF89a'))
const WEBP = Uint8Array.from(Buffer.from('RIFFxxxxWEBP'))

function result(stdout: Uint8Array, stderr = '', exitCode = 0): ClipboardCommandResult {
  return { stdout, stderr, exitCode }
}

function missing(file: string): ClipboardImageError {
  return new ClipboardImageError('PROGRAM_NOT_FOUND', `${file} is not installed.`)
}

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter & { setEncoding(encoding: string): void }
    kill(): boolean
  }
  child.stdout = new EventEmitter()
  child.stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })
  child.kill = vi.fn(() => true)
  return child
}

describe('readClipboardImage', () => {
  it('reads Windows clipboard images as PNG without temporary files', async () => {
    const runner = vi.fn<ClipboardCommandRunner>().mockResolvedValue(result(PNG))

    await expect(readClipboardImage({ platform: 'win32', maxBytes: 1024, runner })).resolves.toEqual({
      data: PNG,
      mediaType: 'image/png',
      name: 'clipboard.png',
    })
    const command = runner.mock.calls[0]?.[0]
    expect(command?.file).toBe('powershell.exe')
    expect(command?.args).toContain('-NoProfile')
    expect(command?.args).toContain('-NonInteractive')
    const script = command?.args.at(-1) ?? ''
    expect(script).toContain('Get-Clipboard -Format Image')
    expect(script).toContain('OpenStandardOutput')
    expect(script).not.toMatch(/temp|WriteAllBytes|Set-Content/iu)
  })

  it('reports the Windows no-image marker', async () => {
    const runner = vi.fn<ClipboardCommandRunner>().mockResolvedValue(
      result(new Uint8Array(), 'DSH_CLIPBOARD_NO_IMAGE', 3),
    )

    const failure = readClipboardImage({ platform: 'win32', maxBytes: 1024, runner })
    await expect(failure).rejects.toMatchObject({ code: 'NO_IMAGE' })
  })

  it('reports a missing pngpaste executable on macOS', async () => {
    const runner = vi.fn<ClipboardCommandRunner>().mockRejectedValue(missing('pngpaste'))

    const failure = readClipboardImage({ platform: 'darwin', maxBytes: 1024, runner })
    await expect(failure).rejects.toMatchObject({ code: 'PROGRAM_NOT_FOUND' })
    expect(runner).toHaveBeenCalledWith(
      { file: 'pngpaste', args: ['-'] },
      { maxBytes: 1024 },
    )
  })

  it('uses xclip when wl-paste is not installed', async () => {
    const commands: ClipboardCommand[] = []
    const runner: ClipboardCommandRunner = async (command) => {
      commands.push(command)
      if (command.file === 'wl-paste') throw missing(command.file)
      if (command.args.includes('TARGETS')) return result(Uint8Array.from(Buffer.from('text/plain\nimage/png\n')))
      return result(PNG)
    }

    await expect(readClipboardImage({ platform: 'linux', maxBytes: 1024, runner }))
      .resolves.toMatchObject({ mediaType: 'image/png' })
    expect(commands).toEqual([
      { file: 'wl-paste', args: ['--list-types'] },
      { file: 'xclip', args: ['-selection', 'clipboard', '-t', 'TARGETS', '-o'] },
      { file: 'xclip', args: ['-selection', 'clipboard', '-t', 'image/png', '-o'] },
    ])
  })

  it('reports both Linux helper requirements when neither is installed', async () => {
    const runner: ClipboardCommandRunner = async command => Promise.reject(missing(command.file))

    const failure = readClipboardImage({ platform: 'linux', maxBytes: 1024, runner })
    await expect(failure).rejects.toMatchObject({
      code: 'PROGRAM_NOT_FOUND',
      message: expect.stringContaining('wl-paste or xclip'),
    })
  })

  it('selects the first supported Wayland image target', async () => {
    const runner = vi.fn<ClipboardCommandRunner>()
      .mockResolvedValueOnce(result(Uint8Array.from(Buffer.from('text/plain\nimage/gif\nimage/jpeg\n'))))
      .mockResolvedValueOnce(result(JPEG))

    await expect(readClipboardImage({ platform: 'linux', maxBytes: 1024, runner }))
      .resolves.toMatchObject({ mediaType: 'image/jpeg', name: 'clipboard.jpg' })
    expect(runner.mock.calls[1]?.[0]).toEqual({
      file: 'wl-paste',
      args: ['--no-newline', '--type', 'image/jpeg'],
    })
  })

  it('does not fall back to xclip for a Wayland clipboard without an image', async () => {
    const runner = vi.fn<ClipboardCommandRunner>().mockResolvedValue(
      result(Uint8Array.from(Buffer.from('text/plain\ntext/html\n'))),
    )

    const failure = readClipboardImage({ platform: 'linux', maxBytes: 1024, runner })
    await expect(failure).rejects.toMatchObject({ code: 'NO_IMAGE' })
    expect(runner).toHaveBeenCalledOnce()
  })

  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
    ['GIF87a', GIF87, 'image/gif'],
    ['GIF89a', GIF89, 'image/gif'],
    ['WebP', WEBP, 'image/webp'],
  ] as const)('detects %s signatures', (_label, bytes, expected) => {
    expect(detectImageMediaType(bytes)).toBe(expected)
  })

  it('rejects empty and unrecognized command output', async () => {
    const runner = vi.fn<ClipboardCommandRunner>()
      .mockResolvedValueOnce(result(new Uint8Array()))
      .mockResolvedValueOnce(result(Uint8Array.from(Buffer.from('not an image'))))

    await expect(readClipboardImage({ platform: 'darwin', maxBytes: 1024, runner }))
      .rejects.toMatchObject({ code: 'NO_IMAGE' })
    await expect(readClipboardImage({ platform: 'darwin', maxBytes: 1024, runner }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_IMAGE' })
  })
})

describe('runClipboardCommand', () => {
  it('terminates a helper whose stdout exceeds the byte limit', async () => {
    const child = fakeChild()
    spawn.mockReturnValueOnce(child)
    const pending = runClipboardCommand({ file: 'image-helper', args: [] }, { maxBytes: 4 })
    child.stdout.emit('data', Buffer.from([1, 2, 3, 4, 5]))
    child.emit('close', 0)

    await expect(pending).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' })
    expect(child.kill).toHaveBeenCalledOnce()
  })

  it('settles on abort even when close follows', async () => {
    const child = fakeChild()
    spawn.mockReturnValueOnce(child)
    const controller = new AbortController()
    const reason = new Error('cancel capture')
    const pending = runClipboardCommand(
      { file: 'image-helper', args: [] },
      { maxBytes: 1024, signal: controller.signal },
    )
    controller.abort(reason)
    child.emit('close', 0)

    await expect(pending).rejects.toBe(reason)
    expect(child.kill).toHaveBeenCalledOnce()
  })

  it('maps spawn ENOENT to a program-not-found failure', async () => {
    const child = fakeChild()
    spawn.mockReturnValueOnce(child)
    const pending = runClipboardCommand({ file: 'missing-helper', args: [] }, { maxBytes: 1024 })
    const error = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
    child.emit('error', error)

    await expect(pending).rejects.toMatchObject({
      code: 'PROGRAM_NOT_FOUND',
      message: expect.stringContaining('missing-helper'),
    })
  })
})
