import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Rasterize `node` (e.g. the 1280×905 certificate template) into a landscape
 * PDF and trigger a download. Waits for images inside the node to finish
 * loading so the logo / signature always appear in the PDF.
 */
export async function downloadCertificatePdf(node: HTMLElement, fileName: string) {
  // Give webfonts/images a moment to settle before capturing.
  await waitForImages(node);
  await new Promise((r) => setTimeout(r, 60));

  const width = node.offsetWidth;
  const height = node.offsetHeight;

  const canvas = await html2canvas(node, {
    scale: 2, // 2× for crisp print output
    backgroundColor: "#0b0f0e",
    useCORS: true,
    logging: false,
    windowWidth: document.documentElement.scrollWidth,
  });

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [width, height],
    compress: true,
  });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, width, height);
  pdf.save(fileName);
}

function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }
        }),
    ),
  );
}
