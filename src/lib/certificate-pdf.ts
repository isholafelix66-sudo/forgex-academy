import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** Certificate design size (matches the template). */
const DESIGN_W = 1280;
const DESIGN_H = 905;
const BG = "#0b0f0e";

/**
 * Rasterize the 1280×905 certificate node at 2×. Waits for fonts and images
 * (logo / signature) so the export always matches what's on screen.
 */
async function buildCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* non-fatal */
    }
  }
  await waitForImages(node);
  await new Promise((r) => setTimeout(r, 120));

  // High-res pass first; some devices reject very large canvases, so retry
  // at 1× if the browser throws.
  try {
    return await html2canvas(node, {
      scale: 2,
      backgroundColor: BG,
      useCORS: true,
      logging: false,
    });
  } catch {
    return await html2canvas(node, {
      scale: 1,
      backgroundColor: BG,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
  }
}

/** Safely turn a canvas into a data URL, falling back to PNG if JPEG taints. */
function canvasDataUrl(canvas: HTMLCanvasElement, mime: string): string {
  try {
    return canvas.toDataURL(mime, 0.95);
  } catch {
    return canvas.toDataURL("image/png");
  }
}

/**
 * Save a blob the most reliable way available:
 *   1. Mobile/tablet → OS share sheet (Save to Files / Photos) via navigator.share
 *   2. Desktop → anchor download
 *   3. Anything blocked → open the file in a new tab so it can be saved manually
 */
async function saveOrOpen(file: File): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title: string }) => Promise<void>;
  };

  if (typeof nav.canShare === "function" && typeof nav.share === "function") {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: file.name });
        return; // Saved/shared through the OS
      }
    } catch (e) {
      // "AbortError" = the user dismissed the sheet — not a failure.
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Otherwise fall through to the download path.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    triggerDownload(url, file.name);
  } catch {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Rasterize `node` (the 1280×905 certificate template) into a landscape PDF
 * and save/download it.
 */
export async function downloadCertificatePdf(node: HTMLElement, fileName: string) {
  const canvas = await buildCanvas(node);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [DESIGN_W, DESIGN_H],
  });
  const dataUrl = canvasDataUrl(canvas, "image/jpeg");
  const mime = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
  pdf.addImage(dataUrl, mime, 0, 0, DESIGN_W, DESIGN_H);

  const blob = pdf.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });
  await saveOrOpen(file);
}

/** Rasterize the certificate as a PNG image and save/download it. */
export async function downloadCertificatePng(node: HTMLElement, fileName: string) {
  const canvas = await buildCanvas(node);
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName.replace(/\.pdf$/i, ".png"), {
    type: "image/png",
  });
  await saveOrOpen(file);
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function waitForImages(node: HTMLElement, timeoutMs = 5000): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();

  const allLoaded = Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );

  // Never hang the export on a stuck image.
  return Promise.race([
    allLoaded.then(() => undefined),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]);
}
