/**
 * Client-side certificate image export.
 *
 * Captures the EXACT certificate element already rendered on the page
 * (fonts, colors, logo, signature, QR code, layout) and turns it into a
 * high-resolution JPG at 2x — falling back to PNG, then to html2canvas,
 * so a capture failure never crashes the export. Nothing is sent to an
 * external service and nothing about the certificate's visual design is
 * changed.
 *
 * Why a clone with canvas/URL swaps? html-to-image serializes the DOM into
 * an SVG <foreignObject>, which cannot read <canvas> pixel data — the QR
 * code (rendered as a <canvas>) would come out blank. We therefore run the
 * capture on a deep clone of the certificate in which:
 *   - each <canvas> is replaced by an <img> carrying the exact same pixels
 *     as a data URL, and
 *   - cross-origin logo/signature images are inlined as data URLs so the
 *     capture never depends on remote CORS headers.
 * The visible certificate is never touched, so there is no visual flash.
 */

import { toJpeg, toPng } from "html-to-image";
import { sanitizeFileNamePart, saveCertificateFile } from "./certificate-download";

export const CERTIFICATE_BG = "#0b0f0e";

export type ExportedImage = {
  dataUrl: string;
  mime: "image/jpeg" | "image/png";
  ext: "jpg" | "png";
};

/** Wait for fonts and external images (logo / signature) before capturing. */
async function waitForAssets(node: HTMLElement): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts unavailable — capture anyway */
  }
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          // A stuck image must never block the export.
          setTimeout(done, 3000);
        }),
    ),
  );
}

/** Replace <canvas> QR codes with data-URL <img> so they survive serialization. */
function swapCanvasesForImages(root: HTMLElement): void {
  root.querySelectorAll("canvas").forEach((canvas) => {
    let src: string;
    try {
      src = canvas.toDataURL("image/png");
    } catch {
      return; // tainted canvas (should not happen for generated QR codes)
    }
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.width = canvas.width || 104;
    img.height = canvas.height || 104;
    const inline = canvas.getAttribute("style");
    if (inline) img.style.cssText = inline;
    canvas.replaceWith(img);
  });
}

/** Fetch a remote image and inline it as a data URL (best-effort). */
async function inlineImageUrl(
  img: HTMLImageElement,
  url: string,
): Promise<void> {
  if (!url || url.startsWith("data:")) return;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    // Only swap when the fetched image actually decoded — otherwise keep the
    // original URL so the browser can render it the same way it does on page.
    const probe = new Image();
    probe.onload = () => {
      img.src = dataUrl;
    };
    probe.onerror = () => {
      /* keep original URL */
    };
    probe.src = dataUrl;
  } catch {
    /* CORS or network failure — keep the original URL, capture may still work */
  }
}

/** Inline remote images on the clone so capture never needs remote CORS. */
async function inlineRemoteImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    images.map((img) => {
      const url = img.getAttribute("src") ?? img.src;
      if (url && !url.startsWith("data:")) return inlineImageUrl(img, url);
      return Promise.resolve();
    }),
  );
}

/** Last-resort capture via html2canvas (canvas rasterizer, no foreignObject). */
async function captureWithHtml2canvas(
  source: HTMLElement,
): Promise<ExportedImage> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(source, {
    scale: 2,
    backgroundColor: CERTIFICATE_BG,
    useCORS: true,
    logging: false,
  });
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  if (dataUrl.startsWith("data:image/jpeg")) {
    return { dataUrl, mime: "image/jpeg", ext: "jpg" };
  }
  const pngUrl = canvas.toDataURL("image/png");
  return { dataUrl: pngUrl, mime: "image/png", ext: "png" };
}

/**
 * Export a certificate DOM node as a high-quality image (JPG preferred).
 * The visible certificate is never mutated — the capture runs on an
 * off-screen clone at its full 1280x905 design size. The fallback chain is:
 * html-to-image JPG → html-to-image PNG → html2canvas JPG/PNG.
 */
export async function exportCertificateImage(node: HTMLElement): Promise<ExportedImage> {
  await waitForAssets(node);

  const source = node.cloneNode(true) as HTMLElement;
  swapCanvasesForImages(source);
  await inlineRemoteImages(source);

  // Lay the clone out off-screen so it keeps its real layout size.
  const holder = document.createElement("div");
  holder.style.position = "absolute";
  holder.style.left = "-100000px";
  holder.style.top = "0";
  holder.style.width = "0";
  holder.style.height = "0";
  holder.style.overflow = "hidden";
  holder.style.pointerEvents = "none";
  holder.appendChild(source);
  document.body.appendChild(holder);

  // No cacheBust — it appends cache-busting params to asset URLs which can
  // break signed/CDN image URLs and add extra failure points.
  const common = {
    pixelRatio: 2, // crisp 2x output (2560x1810 for the 1280x905 design)
    backgroundColor: CERTIFICATE_BG,
  } as const;

  try {
    try {
      const dataUrl = await toJpeg(source, { ...common, quality: 0.92 });
      return { dataUrl, mime: "image/jpeg", ext: "jpg" };
    } catch (jpgError) {
      // Never crash the export because JPG encoding failed — use PNG instead.
      console.error("[certificate] JPG export failed — falling back to PNG:", jpgError);
      try {
        const dataUrl = await toPng(source, common);
        return { dataUrl, mime: "image/png", ext: "png" };
      } catch (pngError) {
        // Final fallback: html2canvas rasterizer.
        console.error("[certificate] PNG export failed — trying html2canvas:", pngError);
        return await captureWithHtml2canvas(source);
      }
    }
  } finally {
    holder.remove();
  }
}

/**
 * Save a captured certificate image to the device with a sanitized
 * ForgeX-Certificate-<Recipient>-<CertificateId>.<jpg|png> filename, reusing
 * the same share/download path as PDFs (OS share sheet on mobile, anchor
 * download on desktop).
 */
export async function saveExportedImage(
  dataUrl: string,
  ext: "jpg" | "png",
  recipientName: string,
  certificateId: string,
): Promise<void> {
  const baseName = `ForgeX-Certificate-${sanitizeFileNamePart(recipientName)}-${certificateId}`;
  const mime = ext === "jpg" ? "image/jpeg" : "image/png";
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  await saveCertificateFile(`${baseName}.${ext}`, mime, base64);
}
