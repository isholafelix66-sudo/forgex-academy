/**
 * jpeg-js ships no TypeScript types; @types/jpeg-js is an empty stub.
 * Declare the minimal API surface used by the certificate pipeline
 * (PNG -> JPEG conversion in the Convex action).
 */
declare module "jpeg-js" {
  export interface BitmapImageData {
    data: Uint8Array | Buffer;
    width: number;
    height: number;
  }

  export interface RawImageData extends BitmapImageData {}

  /** Encode RGBA image data into a JPEG. Returns the JPEG bytes in `.data`. */
  export function encode(
    imgData: BitmapImageData,
    quality?: number,
  ): RawImageData;

  export function decode(
    jpegData: Uint8Array | Buffer,
    useTArray?: boolean,
  ): RawImageData & { comments?: string[] };
}
