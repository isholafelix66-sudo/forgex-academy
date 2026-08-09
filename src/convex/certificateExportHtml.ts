"use node";

import { PNG } from "pngjs";
import { encode as encodeJpeg } from "jpeg-js";

/**
 * Pure helpers shared by the certificate export action. No Convex imports —
 * this module only builds HTML strings and converts image buffers, so it can
 * be exercised directly by tests and stays easy to keep in sync with
 * components/site/CertificateTemplate.tsx.
 */

export const DESIGN_W = 1280;
export const DESIGN_H = 905;

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

/** Turn a recipient name into a safe filename fragment. */
export function sanitizeFileNamePart(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
      .replace(/[^A-Za-z0-9 ._-]/g, "") // only letters, digits, space, . _ -
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim()
      .slice(0, 50) || "Recipient"
  );
}

// ---------------------------------------------------------------------------
// HTML builder — mirrors components/site/CertificateTemplate.tsx exactly
// (same 1280x905 layout, colors and typography) so the generated file matches
// the certificate shown on the website.
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Day-first date, identical to the template: "Awarded 8 Aug 2026". */
export function formatDayFirst(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** #rrggbb -> rgba() string. */
function rgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeAccent(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#a3e635";
}

/** Inline check icon — matches the template's CheckIcon. */
function checkIcon(size: number, color: string): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="3.2" stroke-linecap="round" ` +
    `stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;">` +
    `<polyline points="20 6 9 17 4 12"/></svg>`
  );
}

export type CertBranding = {
  institutionName: string;
  motto: string;
  signatoryName: string;
  signatoryTitle: string;
  logoUrl: string | null;
  signatureUrl: string | null;
  accentColor: string;
};

export function buildCertificateHtml(opts: {
  certificateId: string;
  studentName: string;
  courseTitle: string;
  issuedAt: number;
  branding: CertBranding;
  qrDataUrl: string;
}): string {
  const { certificateId, studentName, courseTitle, issuedAt, branding, qrDataUrl } = opts;
  const accent = normalizeAccent(branding.accentColor);
  const bg = "#0b0f0e"; // electric black
  const ink = "#f4f4f5"; // off-white text
  const muted = "#9ca3af"; // muted text
  const brand = "#a3e635"; // ForgeX lime green (institution, certificate ID)

  const header = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="" style="height:66px;max-width:280px;object-fit:contain;display:inline-block;"/>`
    : `<div style="width:68px;height:68px;margin:0 auto;border-radius:50%;border:2px solid ${accent};background:${rgba(accent, 0.14)};display:flex;align-items:center;justify-content:center;">${checkIcon(34, accent)}</div>`;

  const signatureBlock =
    branding.signatureUrl || branding.signatoryName
      ? `<div style="text-align:center;width:330px;">
          ${
            branding.signatureUrl
              ? `<img src="${escapeHtml(branding.signatureUrl)}" alt="" style="height:54px;max-width:330px;object-fit:contain;margin-bottom:4px;display:inline-block;"/>`
              : `<div style="height:58px;"></div>`
          }
          <div style="border-top:1px solid rgba(255,255,255,0.25);padding-top:8px;font-weight:700;font-size:16px;color:${ink};">${escapeHtml(branding.signatoryName)}</div>
          <div style="font-size:12px;color:${muted};margin-top:3px;letter-spacing:1px;">${escapeHtml(branding.signatoryTitle)}</div>
        </div>`
      : "";

  return `<div style="position:relative;width:${DESIGN_W}px;height:${DESIGN_H}px;background:${bg};color:${ink};font-family:'Segoe UI',system-ui,-apple-system,Arial,sans-serif;overflow:hidden;box-sizing:border-box;">
    <!-- Faint grid texture -->
    <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 54px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 54px);"></div>
    <!-- Thin card border -->
    <div style="position:absolute;inset:22px;border:1px solid rgba(255,255,255,0.16);border-radius:20px;"></div>
    <!-- Brand header -->
    <div style="position:absolute;top:96px;left:0;right:0;text-align:center;padding:0 140px;">
      ${header}
      <div style="font-size:22px;font-weight:700;letter-spacing:6px;text-transform:uppercase;margin-top:16px;color:${brand};">${escapeHtml(branding.institutionName)}</div>
    </div>
    <!-- Body -->
    <div style="position:absolute;top:302px;left:0;right:0;text-align:center;padding:0 150px;">
      <div style="font-size:46px;font-weight:700;letter-spacing:1px;color:${ink};">Certificate of Completion</div>
      <div style="font-size:19px;font-style:italic;color:${muted};margin-top:26px;">This certifies that</div>
      <div style="font-size:54px;font-weight:700;color:${accent};margin-top:12px;line-height:1.15;overflow-wrap:break-word;">${escapeHtml(studentName)}</div>
      <div style="font-size:19px;font-style:italic;color:${muted};margin-top:16px;">has successfully completed the course</div>
      <div style="font-size:30px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${ink};margin-top:10px;overflow-wrap:break-word;">${escapeHtml(courseTitle)}</div>
      <div style="font-size:15px;color:${muted};margin-top:22px;">Awarded ${escapeHtml(formatDayFirst(issuedAt))}</div>
    </div>
    <!-- Footer row -->
    <div style="position:absolute;bottom:92px;left:118px;right:118px;display:flex;align-items:flex-end;justify-content:space-between;gap:40px;">
      <div style="width:320px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2.5px;color:${muted};">Certificate ID</div>
        <div style="margin-top:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;color:${brand};">${escapeHtml(certificateId)}</div>
        <div style="margin-top:14px;display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:999px;background:${rgba(accent, 0.12)};border:1px solid ${rgba(accent, 0.4)};font-size:12px;font-weight:600;letter-spacing:0.3px;color:${accent};">${checkIcon(13, accent)} Verified online</div>
      </div>
      ${signatureBlock}
      <div>
        <div style="background:#ffffff;border-radius:10px;padding:10px;display:inline-block;">
          <img src="${qrDataUrl}" width="104" height="104" style="display:block;" alt="Scan to verify this certificate"/>
        </div>
      </div>
    </div>
  </div>`;
}

/** Convert an opaque PNG buffer into a real JPEG (server-side, pure JS). */
export function pngToJpeg(pngBuffer: Buffer): Buffer {
  const png = PNG.sync.read(pngBuffer);
  const encoded = encodeJpeg(
    { data: png.data, width: png.width, height: png.height },
    92,
  );
  return Buffer.from(encoded.data);
}
