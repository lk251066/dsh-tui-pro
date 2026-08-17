/**
 * System clipboard image capture for supported desktop platforms.
 * @module @lk251066/dsh-tui/clipboard-image
 */

import { spawn } from 'node:child_process'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'

type ImageAttachmentRef = Extract<ContentBlock, { type: 'image' }>['attachment']

/** Raster media types supported by dsh image attachments. */
export type ImageMediaType = ImageAttachmentRef['mediaType']

/** One external command used to read clipboard bytes or advertised targets. */
export interface ClipboardCommand {
  readonly file: string
  readonly args: readonly string[]
}

/** Captured output from one clipboard command. */
export interface ClipboardCommandResult {
  readonly stdout: Uint8Array
  readonly stderr: string
  readonly exitCode: number
}

/** Injectable command runner used by clipboard capture. */
export type ClipboardCommandRunner = (
  command: ClipboardCommand,
  options: { readonly maxBytes: number; readonly signal?: AbortSignal },
) => Promise<ClipboardCommandResult>

/** Encoded image bytes read from the system clipboard. */
export interface ClipboardImage {
  readonly data: Uint8Array
  readonly mediaType: ImageMediaType
  readonly name: string
}

/** Stable clipboard-image failure categories for terminal notices. */
export type ClipboardImageErrorCode =
  | 'NO_IMAGE'
  | 'PROGRAM_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'IMAGE_TOO_LARGE'
  | 'UNSUPPORTED_IMAGE'

/** Clipboard image failure with a stable code suitable for UI routing. */
export class ClipboardImageError extends Error {
  readonly code: ClipboardImageErrorCode

  /**
   * @param code - Stable failure category.
   * @param message - Human-readable failure detail.
   * @param options - Optional underlying error.
   */
  constructor(code: ClipboardImageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ClipboardImageError'
    this.code = code
  }
}

/** Options for reading one image from the system clipboard. */
export interface ReadClipboardImageOptions {
  readonly maxBytes: number
  readonly platform?: NodeJS.Platform
  readonly runner?: ClipboardCommandRunner
  readonly signal?: AbortSignal
}

const WINDOWS_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$image = Get-Clipboard -Format Image -ErrorAction SilentlyContinue",
  'if ($null -eq $image) {',
  "  [Console]::Error.Write('DSH_CLIPBOARD_NO_IMAGE')",
  '  exit 3',
  '}',
  '$stream = [System.IO.MemoryStream]::new()',
  'try {',
  '  $image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)',
  '  $bytes = $stream.ToArray()',
  '  [Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)',
  '} finally {',
  '  $stream.Dispose()',
  '  $image.Dispose()',
  '}',
].join('\n')

const MEDIA_TYPE_ORDER: readonly ImageMediaType[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]

const FILE_NAMES: Readonly<Record<ImageMediaType, string>> = {
  'image/png': 'clipboard.png',
  'image/jpeg': 'clipboard.jpg',
  'image/webp': 'clipboard.webp',
  'image/gif': 'clipboard.gif',
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

function programNotFound(command: ClipboardCommand, error: NodeJS.ErrnoException): ClipboardImageError {
  return new ClipboardImageError(
    'PROGRAM_NOT_FOUND',
    `Clipboard helper ${command.file} is not installed.`,
    { cause: error },
  )
}

/**
 * Run one clipboard helper and capture binary stdout with a strict byte limit.
 * @param command - Executable and argument vector.
 * @param options - Output limit and optional cancellation signal.
 * @returns Captured stdout, stderr, and exit code.
 */
export function runClipboardCommand(
  command: ClipboardCommand,
  options: { readonly maxBytes: number; readonly signal?: AbortSignal },
): Promise<ClipboardCommandResult> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new RangeError('Clipboard command maxBytes must be a positive safe integer.')
  }
  if (options.signal?.aborted === true) return Promise.reject(abortReason(options.signal))

  return new Promise((resolve, reject) => {
    const child = spawn(command.file, [...command.args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    let stdoutBytes = 0
    let stderr = ''
    let settled = false

    const cleanup = (): void => {
      options.signal?.removeEventListener('abort', onAbort)
    }
    const fail = (error: unknown, kill = false): void => {
      if (settled) return
      settled = true
      cleanup()
      if (kill) child.kill()
      reject(error)
    }
    const onAbort = (): void => { fail(abortReason(options.signal as AbortSignal), true) }

    options.signal?.addEventListener('abort', onAbort, { once: true })
    child.once('error', (error: NodeJS.ErrnoException) => {
      fail(error.code === 'ENOENT' ? programNotFound(command, error) : error)
    })
    child.stdout.once('error', fail)
    child.stderr.once('error', fail)
    child.stdout.on('data', (chunk: Buffer | Uint8Array | string) => {
      if (settled) return
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      stdoutBytes += bytes.byteLength
      if (stdoutBytes > options.maxBytes) {
        fail(new ClipboardImageError(
          'IMAGE_TOO_LARGE',
          `Clipboard image exceeds the ${String(options.maxBytes)} byte limit.`,
        ), true)
        return
      }
      stdout.push(bytes)
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string | Buffer) => { stderr += String(chunk) })
    child.once('close', (code) => {
      if (settled) return
      settled = true
      cleanup()
      resolve({
        stdout: new Uint8Array(Buffer.concat(stdout, stdoutBytes)),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
      })
    })
  })
}

function hasBytes(data: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => data[offset + index] === value)
}

/**
 * Identify a supported image format from its encoded byte signature.
 * @param data - Encoded candidate image bytes.
 * @returns The verified media type, or undefined for unknown bytes.
 */
export function detectImageMediaType(data: Uint8Array): ImageMediaType | undefined {
  if (hasBytes(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (hasBytes(data, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (hasBytes(data, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
    || hasBytes(data, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'image/gif'
  if (hasBytes(data, [0x52, 0x49, 0x46, 0x46])
    && hasBytes(data, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return undefined
}

function imageFromBytes(data: Uint8Array): ClipboardImage {
  if (data.byteLength === 0) {
    throw new ClipboardImageError('NO_IMAGE', 'The clipboard does not contain an image.')
  }
  const mediaType = detectImageMediaType(data)
  if (mediaType === undefined) {
    throw new ClipboardImageError('UNSUPPORTED_IMAGE', 'The clipboard data is not a supported image.')
  }
  return { data, mediaType, name: FILE_NAMES[mediaType] }
}

function commandFailure(command: ClipboardCommand, result: ClipboardCommandResult): ClipboardImageError {
  const detail = result.stderr === '' ? `exit code ${String(result.exitCode)}` : result.stderr
  return new ClipboardImageError('COMMAND_FAILED', `${command.file} failed: ${detail}`)
}

async function runSuccessful(
  command: ClipboardCommand,
  runner: ClipboardCommandRunner,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const result = await runner(command, { maxBytes, ...(signal === undefined ? {} : { signal }) })
  if (result.exitCode !== 0) throw commandFailure(command, result)
  return result.stdout
}

async function readWindows(
  runner: ClipboardCommandRunner,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<ClipboardImage> {
  const command: ClipboardCommand = {
    file: 'powershell.exe',
    args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_SCRIPT],
  }
  const result = await runner(command, { maxBytes, ...(signal === undefined ? {} : { signal }) })
  if (result.exitCode === 3 && result.stderr.includes('DSH_CLIPBOARD_NO_IMAGE')) {
    throw new ClipboardImageError('NO_IMAGE', 'The clipboard does not contain an image.')
  }
  if (result.exitCode !== 0) throw commandFailure(command, result)
  return imageFromBytes(result.stdout)
}

async function readMacos(
  runner: ClipboardCommandRunner,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<ClipboardImage> {
  const command: ClipboardCommand = { file: 'pngpaste', args: ['-'] }
  return imageFromBytes(await runSuccessful(command, runner, maxBytes, signal))
}

function selectMediaType(targets: Uint8Array): ImageMediaType | undefined {
  const available = new Set(Buffer.from(targets).toString('utf8').split(/\s+/u))
  return MEDIA_TYPE_ORDER.find(mediaType => available.has(mediaType))
}

async function readLinuxWith(
  helper: 'wl-paste' | 'xclip',
  runner: ClipboardCommandRunner,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<ClipboardImage> {
  const listCommand: ClipboardCommand = helper === 'wl-paste'
    ? { file: helper, args: ['--list-types'] }
    : { file: helper, args: ['-selection', 'clipboard', '-t', 'TARGETS', '-o'] }
  const targets = await runSuccessful(listCommand, runner, 64 * 1024, signal)
  const mediaType = selectMediaType(targets)
  if (mediaType === undefined) {
    throw new ClipboardImageError('NO_IMAGE', 'The clipboard does not contain a supported image.')
  }
  const readCommand: ClipboardCommand = helper === 'wl-paste'
    ? { file: helper, args: ['--no-newline', '--type', mediaType] }
    : { file: helper, args: ['-selection', 'clipboard', '-t', mediaType, '-o'] }
  return imageFromBytes(await runSuccessful(readCommand, runner, maxBytes, signal))
}

async function readLinux(
  runner: ClipboardCommandRunner,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<ClipboardImage> {
  try {
    return await readLinuxWith('wl-paste', runner, maxBytes, signal)
  } catch (error: unknown) {
    if (!(error instanceof ClipboardImageError) || error.code !== 'PROGRAM_NOT_FOUND') throw error
  }

  try {
    return await readLinuxWith('xclip', runner, maxBytes, signal)
  } catch (error: unknown) {
    if (!(error instanceof ClipboardImageError) || error.code !== 'PROGRAM_NOT_FOUND') throw error
    throw new ClipboardImageError(
      'PROGRAM_NOT_FOUND',
      'Clipboard image capture requires wl-paste or xclip on Linux.',
      { cause: error },
    )
  }
}

/**
 * Read one supported image from the operating-system clipboard.
 * @param options - Byte limit, platform override, command runner, and cancellation.
 * @returns Verified encoded image bytes and their detected media type.
 */
export async function readClipboardImage(options: ReadClipboardImageOptions): Promise<ClipboardImage> {
  const runner = options.runner ?? runClipboardCommand
  const platform = options.platform ?? process.platform
  switch (platform) {
    case 'win32':
      return readWindows(runner, options.maxBytes, options.signal)
    case 'darwin':
      return readMacos(runner, options.maxBytes, options.signal)
    case 'linux':
      return readLinux(runner, options.maxBytes, options.signal)
    default:
      throw new ClipboardImageError(
        'PROGRAM_NOT_FOUND',
        `Clipboard image capture is not supported on ${platform}.`,
      )
  }
}
