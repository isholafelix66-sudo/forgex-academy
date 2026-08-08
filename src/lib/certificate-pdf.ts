import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Rasterize `node` (the 1280×905 certificate template) into a landscape PDF
 * and trigger a download. Waits for images inside the node to finish loading
 * so the logo / signature always appear in the PDF, then saves through a blob
 * anchor with an iOS-safe fallback (iOS Safari cannot always save blob links,
 * so the PDF is opened in a new tab where the user can share/save it).
 */
export async function downloadCertificatePdf(node: HTMLElement, fileName: string) {
  await waitForImages(node);
  await new Promise((r) => setTimeout(r, 80));

  const width = node.offsetWidth || 1280;
  const height = node.offsetHeight || 905;

  // Capture at 2× for crisp print; retry at 1× if the browser rejects the
  // high-res pass (some devices fail on very large canvases).
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#0b0f0e",
      useCORS: true,
      logging: false,
    });
  } catch {
    canvas = await html2canvas(node, {
      scale: 1,
      backgroundColor: "#0b0f0e",
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
  }

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [width, height],
  });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, width, height);

  try {
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    triggerDownload(url, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    // Last resort: open the PDF in a new tab so the user can save it.
    const url = pdf.output("bloburl").toString();
    window.open(url, "_blank", "noopener");
  }
}

function triggerDownload(url: string, fileName: string) {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh|MacIntel/.test(navigator.userAgent) &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1);

  if (isIOS) {
    // iOS Safari ignores <a download> for blob URLs — open the PDF in a tab.
    window.open(url, "_blank", "noopener");
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function waitForImages(node: HTMLElement, timeoutMs = 4000): Promise<void> {
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

  // Never hang the download on a stuck image.
  const allLoadedVoid: Promise<void> = allLoaded.then(() => undefined);
  return Promise.race([
    allLoadedVoid,
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]);
}
