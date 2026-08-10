/**
 * Client-side certificate PDF generation (guaranteed fallback).
 *
 * The primary path for "Download as PDF" is the server-side APITemplate
 * action (real vector PDF). That path needs a signed-in user AND the
 * APITEMPLATE_API_KEY — so a visitor on the public verification page (or
 * anyone with a missing/broken key) could never download a PDF. This module
 * is the always-works fallback: it embeds the certificate JPG already
 * captured client-side (see certificate-export.ts) into a single A4-landscape
 * page. The certificate is designed at 1280×905, which matches A4 landscape
 * (297×210mm) proportions almost exactly, so it fills the page edge to edge.
 *
 * jsPDF embeds JPEG directly with no rasterization round-trip on our side.
 */

import { jsPDF } from "jspdf";
import { sanitizeFileNamePart } from "./certificate-download";

export type GeneratedPdf = {
  fileName: string;
  mime: string;
  base64: string;
};

const A4_LANDSCAPE_MM_W = 297;
const A4_LANDSCAPE_MM_H = 210;

/** Convert any image data URL to a JPEG data URL (draws through a canvas). */
export async function toJpegDataUrl(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith("data:image/jpeg")) return dataUrl;
  const img = new Image();
  img.src = dataUrl; // data URL — never tainted, no CORS involved
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 1280;
  canvas.height = img.naturalHeight || 905;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Build a single-page A4-landscape PDF containing ONLY the certificate.
 * `jpegDataUrl` is the certificate captured at 2x (JPG preferred, PNG
 * accepted — it is re-encoded to JPEG so jsPDF embeds it losslessly of size).
 */
export async function buildCertificatePdf(
  jpegDataUrl: string,
  recipientName: string,
  certificateId: string,
): Promise<GeneratedPdf> {
  const jpeg = await toJpegDataUrl(jpegDataUrl);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // The certificate fills the whole page — no chrome, no margins.
  doc.addImage(
    jpeg,
    "JPEG",
    0,
    0,
    A4_LANDSCAPE_MM_W,
    A4_LANDSCAPE_MM_H,
    undefined,
    "FAST",
  );

  const dataUrl = doc.output("datauristring");
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const baseName = `ForgeX-Certificate-${sanitizeFileNamePart(recipientName)}-${certificateId}`;
  return { fileName: `${baseName}.pdf`, mime: "application/pdf", base64 };
}
