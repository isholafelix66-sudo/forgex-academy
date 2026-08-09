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

const APITEMPLATE_API = "https://rest.apitemplate.io/v2";

function apiTemplateKey(): string {
  const key = process.env.APITEMPLATE_API_KEY;
  if (!key) {
    throw new Error(
      "PDF generation isn't configured yet. Add the APITEMPLATE_API_KEY in the project keys, then try again.",
    );
  }
  return key;
}

/**
 * Render the certificate HTML into a PDF through APITemplate
 * (POST /v2/create-pdf-from-html — the design is sent each time). Tries an
 * exact pixel paper size first, falling back to millimetres if the API
 * rejects that value.
 */
async function generatePdfFromHtml(html: string, css: string): Promise<string> {
  const makeSettings = (paperSize: string) => ({
    paper_size: paperSize,
    orientation: "2", // landscape
    margin_top: "0",
    margin_right: "0",
    margin_bottom: "0",
    margin_left: "0",
    print_background: "1",
  });

  const attempts: Array<{ settings: ReturnType<typeof makeSettings> }> = [
    { settings: makeSettings(`${DESIGN_W}px x ${DESIGN_H}px`) },
    {
      settings: makeSettings(
        `${Math.round((DESIGN_W / 96) * 25.4 * 10) / 10}mm x ${Math.round((DESIGN_H / 96) * 25.4 * 10) / 10}mm`,
      ),
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    const res = await fetch(`${APITEMPLATE_API}/create-pdf-from-html`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiTemplateKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: html, css, settings: attempt.settings }),
    });
    const text = await res.text();
    if (res.ok) {
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("APITemplate returned an unreadable response. Please try again.");
      }
      if (json?.status === "success" && typeof json?.download_url === "string") {
        return json.download_url as string;
      }
      console.error("[apitemplate] generation failed:", JSON.stringify(json).slice(0, 400));
      throw new Error("APITemplate could not generate the certificate PDF. Please try again.");
    }
    // 4xx (e.g. an unsupported paper size) -> try the next attempt;
    // 5xx -> surface the server error directly.
    lastError = new Error(
      `APITemplate request failed (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
    if (res.status >= 500) break;
  }
  console.error("[apitemplate] all attempts failed:", lastError);
  throw new Error("APITemplate could not generate the certificate PDF. Please try again.");
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

  const css = [
    `@page { size: ${DESIGN_W}px ${DESIGN_H}px; margin: 0; }`,
    "html, body { margin: 0; padding: 0; }",
    "body { background: #0b0f0e; }",
  ].join("\n");

  const downloadUrl = await generatePdfFromHtml(html, css);
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
