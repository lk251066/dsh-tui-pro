import { describe, expect, it, vi } from 'vitest'
import type { ClipboardCommandRunner } from '../src/clipboard-image.ts'
import {
  ImageDraft,
  pasteClipboardImage,
  type ImageAttachmentRef,
  type ImageAttachmentWriter,
  type SaveImageInput,
} from '../src/chat/image-draft.ts'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function attachment(id: string, bytes = PNG.byteLength): ImageAttachmentRef {
  return {
    attachmentId: id,
    mediaType: 'image/png',
    bytes,
    width: 1,
    height: 1,
    name: 'clipboard.png',
  } as unknown as ImageAttachmentRef
}

function clipboardRunner(data = PNG): ClipboardCommandRunner {
  return vi.fn<ClipboardCommandRunner>().mockResolvedValue({ stdout: data, stderr: '', exitCode: 0 })
}

function writer(overrides: Partial<ImageAttachmentWriter> = {}) {
  const validateImage = vi.fn<(_: SaveImageInput) => Promise<void>>().mockResolvedValue()
  const saveImage = vi.fn<(_: SaveImageInput) => Promise<ImageAttachmentRef>>()
    .mockResolvedValue(attachment('stored'))
  return {
    imageLimits: {
      maxImageBytes: 1024,
      maxImagesPerMessage: 4,
      maxMessageImageBytes: 2048,
      mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const,
    },
    validateImage,
    saveImage,
    ...overrides,
  }
}

describe('ImageDraft', () => {
  it('keeps stable numbers when an image is removed', () => {
    const draft = new ImageDraft()
    const first = draft.addStored(attachment('one'))
    const second = draft.addStored(attachment('two'))

    expect(first.placeholder).toBe('[Image #1]')
    expect(second.placeholder).toBe('[Image #2]')
    expect(draft.remove(1)).toBe(true)
    expect(draft.remove(99)).toBe(false)
    expect(draft.addStored(attachment('three')).placeholder).toBe('[Image #3]')
    expect(draft.list().map(image => image.number)).toEqual([2, 3])
  })

  it('clears references and resets numbering for the next message', () => {
    const draft = new ImageDraft()
    draft.addStored(attachment('one'))
    draft.clear()

    expect(draft.list()).toEqual([])
    expect(draft.totalBytes()).toBe(0)
    expect(draft.addStored(attachment('next')).placeholder).toBe('[Image #1]')
  })

  it('builds ordered image content blocks and totals encoded bytes', () => {
    const draft = new ImageDraft()
    const first = attachment('one', 11)
    const second = attachment('two', 13)
    draft.addStored(first)
    draft.addStored(second)

    expect(draft.contentBlocks()).toEqual([
      { type: 'image', attachment: first },
      { type: 'image', attachment: second },
    ])
    expect(draft.totalBytes()).toBe(24)
  })
})

describe('pasteClipboardImage', () => {
  it('validates before saving and appends the returned durable reference', async () => {
    const draft = new ImageDraft()
    const attachments = writer()
    const runner = clipboardRunner()

    await expect(pasteClipboardImage(draft, attachments, { platform: 'darwin', runner }))
      .resolves.toMatchObject({ number: 1, placeholder: '[Image #1]' })
    const input = {
      data: PNG,
      mediaType: 'image/png',
      name: 'clipboard.png',
    }
    expect(attachments.validateImage).toHaveBeenCalledWith(input)
    expect(attachments.saveImage).toHaveBeenCalledWith(input)
    expect(attachments.validateImage.mock.invocationCallOrder[0])
      .toBeLessThan(attachments.saveImage.mock.invocationCallOrder[0] as number)
    expect(draft.contentBlocks()).toEqual([
      { type: 'image', attachment: attachment('stored') },
    ])
  })

  it('leaves the draft unchanged when validation or saving fails', async () => {
    const validationDraft = new ImageDraft()
    const validateImage = vi.fn<(_: SaveImageInput) => Promise<void>>()
      .mockRejectedValue(new Error('invalid dimensions'))
    const validationWriter = writer({ validateImage })

    await expect(pasteClipboardImage(validationDraft, validationWriter, {
      platform: 'darwin',
      runner: clipboardRunner(),
    })).rejects.toThrow('invalid dimensions')
    expect(validationDraft.list()).toEqual([])
    expect(validationWriter.saveImage).not.toHaveBeenCalled()

    const saveDraft = new ImageDraft()
    const saveImage = vi.fn<(_: SaveImageInput) => Promise<ImageAttachmentRef>>()
      .mockRejectedValue(new Error('storage unavailable'))
    const saveWriter = writer({ saveImage })
    await expect(pasteClipboardImage(saveDraft, saveWriter, {
      platform: 'darwin',
      runner: clipboardRunner(),
    })).rejects.toThrow('storage unavailable')
    expect(saveDraft.list()).toEqual([])
  })

  it('rejects the image-count limit before reading the clipboard', async () => {
    const draft = new ImageDraft()
    draft.addStored(attachment('existing'))
    const attachments = writer({
      imageLimits: {
        maxImageBytes: 1024,
        maxImagesPerMessage: 1,
        maxMessageImageBytes: 2048,
        mediaTypes: ['image/png'],
      },
    })
    const runner = clipboardRunner()

    await expect(pasteClipboardImage(draft, attachments, { platform: 'darwin', runner }))
      .rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' })
    expect(runner).not.toHaveBeenCalled()
    expect(attachments.validateImage).not.toHaveBeenCalled()
    expect(attachments.saveImage).not.toHaveBeenCalled()
  })

  it('rejects aggregate bytes and disabled media types before saving', async () => {
    const aggregateDraft = new ImageDraft()
    aggregateDraft.addStored(attachment('existing', 10))
    const aggregateWriter = writer({
      imageLimits: {
        maxImageBytes: 1024,
        maxImagesPerMessage: 4,
        maxMessageImageBytes: 17,
        mediaTypes: ['image/png'],
      },
    })

    await expect(pasteClipboardImage(aggregateDraft, aggregateWriter, {
      platform: 'darwin',
      runner: clipboardRunner(),
    })).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' })
    expect(aggregateWriter.validateImage).not.toHaveBeenCalled()
    expect(aggregateWriter.saveImage).not.toHaveBeenCalled()

    const mediaDraft = new ImageDraft()
    const mediaWriter = writer({
      imageLimits: {
        maxImageBytes: 1024,
        maxImagesPerMessage: 4,
        maxMessageImageBytes: 2048,
        mediaTypes: ['image/jpeg'],
      },
    })
    await expect(pasteClipboardImage(mediaDraft, mediaWriter, {
      platform: 'darwin',
      runner: clipboardRunner(),
    })).rejects.toMatchObject({ code: 'UNSUPPORTED_IMAGE' })
    expect(mediaWriter.validateImage).not.toHaveBeenCalled()
    expect(mediaWriter.saveImage).not.toHaveBeenCalled()
  })

  it('does not call an attachment deletion API when draft references are removed', async () => {
    const draft = new ImageDraft()
    const deleteImage = vi.fn()
    const attachments = Object.assign(writer(), { deleteImage })
    await pasteClipboardImage(draft, attachments, { platform: 'darwin', runner: clipboardRunner() })

    draft.remove(1)
    draft.clear()
    expect(deleteImage).not.toHaveBeenCalled()
  })
})
