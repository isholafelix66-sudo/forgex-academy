/**
 * Browser-side half of the certificate download flow.
 *
 * The Convex action (api.apitemplate.generateCertificate) generates the file
 * server-side via APITemplate.io and returns the bytes as base64 — nothing
 * here rasterizes or screenshots the page. This helper only decodes those
 * bytes and saves them with the sanitized filename on any device.
 */

/** Decode a base64 string into bytes (browser). */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Keep a recipient name safe to use inside a filename. */
export function sanitizeFileNamePart(name: string): string {
  return (
    name
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

/**
 * Save a generated certificate file:
 *   1. Mobile/tablet → OS share sheet (Save to Files / Photos / AirDrop)
 *   2. Desktop → anchor download with the exact filename
 *   3. Anything blocked → open the file in a new tab so it can be saved
 */
export async function saveCertificateFile(
  fileName: string,
  mime: string,
  base64: string,
): Promise<void> {
  const safeName =
    sanitizeFileNamePart(fileName.replace(/\.[A-Za-z0-9]+$/, "")) +
    (fileName.match(/\.[A-Za-z0-9]+$/) ?? [""])[0];
  const bytes = base64ToBytes(base64);
  const blob = new Blob([bytes], { type: mime });
  const file = new File([blob], safeName, { type: mime });

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

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
