/**
 * Per-session image draft state and attachment persistence.
 * @module @lk251066/dsh-tui/chat/image-draft
 */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import {
  ClipboardImageError,
  readClipboardImage,
  type ClipboardCommandRunner,
  type ImageMediaType,
} from '../clipboard-image.ts'

/** Durable image reference used by an image content block. */
export type ImageAttachmentRef = Extract<ContentBlock, { type: 'image' }>['attachment']

/** One persisted image associated with the current editor draft. */
export interface DraftImage {
  readonly number: number
  readonly placeholder: string
  readonly attachment: ImageAttachmentRef
}

/** Image input accepted by the attachment service. */
export interface SaveImageInput {
  readonly data: Uint8Array
  readonly mediaType: ImageMediaType
  readonly name?: string
}

/** Minimal attachment storage surface required by image drafts. */
export interface ImageAttachmentWriter {
  readonly imageLimits: {
    readonly maxImageBytes: number
    readonly maxImagesPerMessage: number
    readonly maxMessageImageBytes: number
    readonly mediaTypes: readonly ImageMediaType[]
  }
  validateImage(input: SaveImageInput): Promise<void>
  saveImage(input: SaveImageInput): Promise<ImageAttachmentRef>
}

/** Mutable per-message collection of persisted image references. */
export class ImageDraft {
  readonly #images: DraftImage[] = []
  #nextNumber = 1

  /** @returns A stable snapshot of current draft images. */
  list(): readonly DraftImage[] {
    return [...this.#images]
  }

  /**
   * Add one successfully persisted attachment to the draft.
   * @param attachment - Durable attachment reference.
   * @returns The numbered draft entry.
   */
  addStored(attachment: ImageAttachmentRef): DraftImage {
    const number = this.#nextNumber
    this.#nextNumber += 1
    const image = { number, placeholder: `[Image #${String(number)}]`, attachment }
    this.#images.push(image)
    return image
  }

  /**
   * Remove one image reference without renumbering remaining entries.
   * @param number - Display number assigned when the image was added.
   * @returns Whether a matching draft image was removed.
   */
  remove(number: number): boolean {
    const index = this.#images.findIndex(image => image.number === number)
    if (index === -1) return false
    this.#images.splice(index, 1)
    return true
  }

  /** Remove all draft references and reset numbering for the next message. */
  clear(): void {
    this.#images.length = 0
    this.#nextNumber = 1
  }

  /** @returns Image content blocks in draft insertion order. */
  contentBlocks(): ContentBlock[] {
    return this.#images.map(({ attachment }) => ({ type: 'image', attachment }))
  }

  /** @returns Total encoded bytes referenced by the current draft. */
  totalBytes(): number {
    return this.#images.reduce((total, image) => total + image.attachment.bytes, 0)
  }
}

/** Optional platform and process controls for clipboard persistence. */
export interface PasteClipboardImageOptions {
  readonly platform?: NodeJS.Platform
  readonly runner?: ClipboardCommandRunner
  readonly signal?: AbortSignal
}

/**
 * Read, validate, persist, and append one clipboard image to a draft.
 * @param draft - Current per-session image draft.
 * @param attachments - Runtime attachment service.
 * @param options - Optional platform, command runner, and cancellation.
 * @returns The persisted and numbered draft image.
 */
export async function pasteClipboardImage(
  draft: ImageDraft,
  attachments: ImageAttachmentWriter,
  options: PasteClipboardImageOptions = {},
): Promise<DraftImage> {
  const limits = attachments.imageLimits
  if (draft.list().length >= limits.maxImagesPerMessage) {
    throw new ClipboardImageError(
      'IMAGE_TOO_LARGE',
      `A message can contain at most ${String(limits.maxImagesPerMessage)} images.`,
    )
  }

  const image = await readClipboardImage({
    maxBytes: limits.maxImageBytes,
    ...(options.platform === undefined ? {} : { platform: options.platform }),
    ...(options.runner === undefined ? {} : { runner: options.runner }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  })
  if (!limits.mediaTypes.includes(image.mediaType)) {
    throw new ClipboardImageError(
      'UNSUPPORTED_IMAGE',
      `Image type ${image.mediaType} is not enabled for this attachment store.`,
    )
  }
  if (image.data.byteLength > limits.maxImageBytes) {
    throw new ClipboardImageError(
      'IMAGE_TOO_LARGE',
      `Clipboard image exceeds the ${String(limits.maxImageBytes)} byte limit.`,
    )
  }
  if (draft.totalBytes() + image.data.byteLength > limits.maxMessageImageBytes) {
    throw new ClipboardImageError(
      'IMAGE_TOO_LARGE',
      `Draft images exceed the ${String(limits.maxMessageImageBytes)} byte message limit.`,
    )
  }

  const input: SaveImageInput = {
    data: image.data,
    mediaType: image.mediaType,
    name: image.name,
  }
  await attachments.validateImage(input)
  const attachment = await attachments.saveImage(input)
  return draft.addStored(attachment)
}
