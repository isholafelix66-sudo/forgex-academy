/**
 * Backward-compatible re-export. The full device-first uploader now lives in
 * `@/components/media/ImageUploader` so it can be reused across admin, tutor,
 * student and public surfaces.
 */
export { ImageUploader, type UploadedImage } from "@/components/media/ImageUploader";
