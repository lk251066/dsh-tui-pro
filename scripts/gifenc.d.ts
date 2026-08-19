declare module 'gifenc' {
  type Palette = number[][]

  interface Encoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: { palette: Palette; delay: number; repeat?: number },
    ): void
    finish(): void
    bytes(): Uint8Array
  }

  interface GifencModule {
    GIFEncoder(): Encoder
    quantize(rgba: Uint8Array, maxColors: number): Palette
    applyPalette(rgba: Uint8Array, palette: Palette): Uint8Array
  }

  const gifenc: GifencModule
  export default gifenc
}
