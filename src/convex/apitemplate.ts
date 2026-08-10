"use node";

import { action, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { toDataURL as qrToDataURL } from "qrcode";
import {
  DESIGN_H,
  DESIGN_W,
  buildCertificateHtml,
  sanitizeFileNamePart,
} from "./certificateExportHtml";

/**
 * Server-side certificate PDF generation via APITemplate.io.
 *
 * Flow (no browser rendering, no screenshots of the webpage):
 *   1. The signed-in client calls generateCertificate with a certificate id
 *      and the public verification URL.
 *   2. This action loads the certificate + branding (the exact data shown on
 *      the verification page) and rebuilds the EXISTING certificate design
 *      (1280x905, electric black + lime) as HTML, embedding a freshly
 *      generated QR code as a data URL so it stays scannable.
 *   3. APITemplate renders that HTML into a PDF
 *      (POST /v2/create-pdf-from-html — no saved template required).
 *   4. The PDF bytes are returned as base64 (well under Convex's 1 MB
 *      action result limit) with a sanitized download filename.
 *
 * The APITemplate API key is read ONLY here, server-side
 * (APITEMPLATE_API_KEY in the project keys) — it never reaches the browser.
 *
 * Note: image downloads (JPG/PNG) are generated CLIENT-SIDE from the
 * certificate element already on screen (see src/lib/certificate-export.ts)
 * — no image-generation service or paid API is involved.
 */



/**
 * Render the certificate HTML into a PDF through APITemplate
 * (POST /v2/create-pdf-from-html — the design is sent each time).
 *
 * APITemplate only accepts standard paper sizes — custom "W x H" values are
 * rejected with HTTP 400 ("Internal error unable to generate PDF"). The
 * certificate is designed at 1280x905, so it is rendered on an A4 landscape
 * page and fitted to it with a CSS transform: the outer wrapper is sized to
 * the printable area (standard CSS every renderer honors — A4 landscape is
 * 297x210mm ≈ 841.9x595.3 px at the renderer's 72 dpi) and the certificate is
 * visually scaled inside it, clipped by overflow:hidden. The aspect ratios
 * match, so the certificate fills the page with no dead space.
 */
const APITEMPLATE_API = "https://rest.apitemplate.io/v2";

/**
 * Resolve the APITemplate API key from the server-side secret, accepting
 * both the raw form (`id:user:key`) and a base64-encoded form — the format
 * shared through the project's Keys UI. The key is read ONLY here on the
 * server; it never reaches the browser. Each candidate is tried until one
 * authenticates (HTTP 401 is the only failure that justifies trying the next
 * candidate).
 */
function apiTemplateKeys(): string[] {
  const raw = process.env.APITEMPLATE_API_KEY ?? "";
  const candidates: string[] = [];
  const trimmed = raw.trim();
  if (trimmed) candidates.push(trimmed);
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
    if (decoded && decoded !== trimmed) candidates.push(decoded);
  } catch {
    /* not valid base64 — only the raw form will be tried */
  }
  return candidates;
}

const PDF_PAGE_W = 840; // A4 landscape printable area @72dpi (page = 841.9x595.3)
const PDF_PAGE_H = 594;
const PDF_FIT_SCALE = PDF_PAGE_W / DESIGN_W; // 0.65625 — 1280x905 -> 840x594

async function generatePdfFromHtml(html: string): Promise<string> {
  const css = [
    "@page { size: A4 landscape; margin: 0; }",
    "html, body { margin: 0; padding: 0; }",
  ].join("\n");

  const settings = {
    paper_size: "A4",
    orientation: "2", // landscape
    margin_top: "0",
    margin_right: "0",
    margin_bottom: "0",
    margin_left: "0",
    print_background: "1",
  };

  // A few scales as insurance: if the renderer rounds the scaled box a hair
  // larger than the page, the API reports total_pages > 1 — retry smaller
  // until the certificate fits a single page.
  const scales = [PDF_FIT_SCALE, PDF_FIT_SCALE * 0.99, PDF_FIT_SCALE * 0.975];

  let lastError: unknown = null;
  // Try each key candidate (raw + decoded form) until one authenticates.
  for (const key of apiTemplateKeys()) {
    let keyTried = false;
    for (const scale of scales) {
      keyTried = true;
      const body = [
        `<div style="width:${PDF_PAGE_W}px;height:${PDF_PAGE_H}px;overflow:hidden;background:#0b0f0e;">`,
        `<div style="transform:scale(${scale});transform-origin:0 0;width:${DESIGN_W}px;height:${DESIGN_H}px;">`,
        html,
        "</div></div>",
      ].join("");

      let res: Response;
      try {
        res = await fetch(`${APITEMPLATE_API}/create-pdf-from-html`, {
          method: "POST",
          headers: {
            "X-API-KEY": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body, css, settings }),
        });
      } catch (netErr) {
        // Network failure — a different key form won't help.
        lastError = netErr;
        break;
      }
      const text = await res.text();
      if (res.ok) {
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          lastError = new Error(
            "APITemplate returned an unreadable response. Please try again.",
          );
          break;
        }
        if (json?.status === "success" && typeof json?.download_url === "string") {
          if (typeof json.total_pages === "number" && json.total_pages > 1) {
            lastError = new Error(
              `Rendered ${json.total_pages} pages instead of 1 — retrying at a smaller scale.`,
            );
            continue;
          }
          return json.download_url as string;
        }
        // The API accepted the request but rejected the job (e.g. account
        // limits). Surface its message so the real cause stays visible.
        lastError = new Error(
          `APITemplate rejected the request: ${JSON.stringify(json).slice(0, 300)}`,
        );
        break;
      }
      lastError = new Error(
        `APITemplate request failed (HTTP ${res.status}): ${text.slice(0, 200)}`,
      );
      if (res.status === 401) break; // wrong key form — try the next candidate
      break; // 4xx (request format) / 5xx (service) — another key won't fix it
    }
    // Only continue to the next key candidate when the failure was a 401.
    if (
      !keyTried ||
      !(lastError instanceof Error) ||
      !/HTTP 401/.test(lastError.message)
    ) {
      break;
    }
  }
  console.error("[apitemplate] all attempts failed:", lastError);
  throw new Error(
    `APITemplate could not generate the certificate PDF. ${
      lastError instanceof Error ? lastError.message.slice(0, 300) : "Please try again."
    }`,
  );
}

async function fetchBytes(url: string, label: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch the generated ${label} (HTTP ${res.status}). Please try again.`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * The generation logic lives in a standalone function with an explicit return
 * type. Declaring it outside the action breaks the type cycle that `api`
 * references create inside an action's own type inference (TS7022).
 */
async function runGenerate(
  ctx: ActionCtx,
  args: {
    certificateId: string;
    verifyUrl: string;
  },
): Promise<{ fileName: string; mime: string; base64: string }> {
  const { certificateId, verifyUrl } = args;
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Please sign in to download certificates.");
  }

  // The same data the verification page displays — never hard-coded.
  const cert = await ctx.runQuery(api.public.verifyCertificate, {
    certificateId,
  });
  if (!cert) throw new Error("Certificate not found.");

  const branding = await ctx.runQuery(api.public.certificateBranding);

  const studentName = cert.studentName || "Recipient";
  const qrDataUrl = await qrToDataURL(verifyUrl, {
    width: 104,
    margin: 0,
    errorCorrectionLevel: "M",
  });

  const html = buildCertificateHtml({
    certificateId: cert.certificateId,
    studentName,
    courseTitle: cert.courseTitle,
    issuedAt: cert.issuedAt,
    branding,
    qrDataUrl,
  });

  const downloadUrl = await generatePdfFromHtml(html);
  const pdf = await fetchBytes(downloadUrl, "certificate PDF");

  const baseName = `ForgeX-Certificate-${sanitizeFileNamePart(studentName)}-${cert.certificateId}`;
  return {
    fileName: `${baseName}.pdf`,
    mime: "application/pdf",
    base64: pdf.toString("base64"),
  };
}

export const generateCertificate = action({
  args: {
    certificateId: v.string(),
    verifyUrl: v.string(),
  },
  handler: async (ctx, args) => {
    return runGenerate(ctx, args);
  },
});
