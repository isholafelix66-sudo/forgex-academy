import { useEffect, useRef, useState, type Ref } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { formatDate } from "@/lib/format";

/**
 * Certificate template + responsive viewer.
 *
 * The template is rendered at a fixed 1280×905 design size using ONLY inline
 * styles with hex colors, so it rasterizes pixel-perfectly to a PDF via
 * html2canvas (Tailwind v4 oklch tokens are deliberately avoided here).
 * The QR code uses a <canvas> (not SVG) so html2canvas captures it natively.
 * `CertificateView` scales that design to fit any container and exposes an
 * unscaled `captureRef` node for high-resolution PDF export.
 */

export const CERTIFICATE_W = 1280;
export const CERTIFICATE_H = 905;

export type CertificateBranding = {
  institutionName: string;
  motto: string;
  signatoryName: string;
  signatoryTitle: string;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  accentColor: string;
};

export const DEFAULT_CERTIFICATE_BRANDING: CertificateBranding = {
  institutionName: "ForgeX Academy",
  motto: "Learn. Build. Succeed.",
  signatoryName: "",
  signatoryTitle: "",
  logoUrl: null,
  signatureUrl: null,
  accentColor: "#a3e635",
};

export type CertificateData = {
  certificateId: string;
  studentName: string;
  courseTitle: string;
  issuedAt: number;
};

function normalizeAccent(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#a3e635";
}

/** #rrggbb -> rgba() string (html2canvas-safe alpha). */
function rgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Small crisp check icon (stroke colored via accent). */
function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function CertificateTemplate({
  cert,
  branding,
  verifyUrl,
}: {
  cert: CertificateData;
  branding: CertificateBranding;
  verifyUrl: string;
}) {
  const accent = normalizeAccent(branding.accentColor);
  const bg = "#0b0f0e"; // electric black
  const ink = "#f4f4f5"; // off-white text
  const muted = "#9ca3af"; // muted text
  const gold = "#eab308"; // yellow-gold (institution, ID)

  return (
    <div
      style={{
        width: CERTIFICATE_W,
        height: CERTIFICATE_H,
        background: bg,
        color: ink,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Faint grid texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 54px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 54px)",
        }}
      />

      {/* Thin card border */}
      <div
        style={{
          position: "absolute",
          inset: 22,
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 20,
        }}
      />

      {/* Brand header */}
      <div
        style={{
          position: "absolute",
          top: 96,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 140px",
        }}
      >
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            style={{ height: 66, objectFit: "contain", maxWidth: 280 }}
          />
        ) : (
          <div
            style={{
              width: 68,
              height: 68,
              margin: "0 auto",
              borderRadius: "50%",
              border: `2px solid ${accent}`,
              background: rgba(accent, 0.14),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              color: accent,
              lineHeight: 1,
            }}
          >
            ✓
          </div>
        )}
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "6px",
            textTransform: "uppercase",
            marginTop: 16,
            color: gold,
          }}
        >
          {branding.institutionName}
        </div>
        {branding.motto ? (
          <div
            style={{
              fontSize: 15,
              fontStyle: "italic",
              letterSpacing: "1.5px",
              color: muted,
              marginTop: 8,
            }}
          >
            {branding.motto}
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div
        style={{
          position: "absolute",
          top: 302,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 150px",
        }}
      >
        <div
          style={{
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: "1px",
            color: ink,
          }}
        >
          Certificate of Completion
        </div>
        <div
          style={{
            fontSize: 19,
            fontStyle: "italic",
            color: muted,
            marginTop: 26,
          }}
        >
          This certifies that
        </div>
        <div
          style={{
            fontSize: 54,
            fontWeight: 700,
            color: accent,
            marginTop: 12,
            lineHeight: 1.15,
            overflowWrap: "break-word",
          }}
        >
          {cert.studentName}
        </div>
        <div
          style={{
            fontSize: 19,
            fontStyle: "italic",
            color: muted,
            marginTop: 16,
          }}
        >
          has successfully completed the course
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: ink,
            marginTop: 10,
            overflowWrap: "break-word",
          }}
        >
          {cert.courseTitle}
        </div>
        <div style={{ fontSize: 15, color: muted, marginTop: 22 }}>
          Awarded {formatDate(cert.issuedAt)}
        </div>
      </div>

      {/* Footer row */}
      <div
        style={{
          position: "absolute",
          bottom: 92,
          left: 118,
          right: 118,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        {/* Certificate ID + Verified online */}
        <div style={{ width: 320 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "2.5px",
              color: muted,
            }}
          >
            Certificate ID
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 16,
              color: gold,
            }}
          >
            {cert.certificateId}
          </div>
          <div
            style={{
              marginTop: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 13px",
              borderRadius: 999,
              background: rgba(accent, 0.12),
              border: `1px solid ${rgba(accent, 0.4)}`,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.3px",
              color: accent,
            }}
          >
            <CheckIcon color={accent} /> Verified online
          </div>
        </div>

        {/* Signature (only when configured) */}
        {(branding.signatureUrl || branding.signatoryName) && (
          <div style={{ textAlign: "center", width: 330 }}>
            {branding.signatureUrl ? (
              <img
                src={branding.signatureUrl}
                alt=""
                style={{
                  height: 54,
                  objectFit: "contain",
                  maxWidth: 330,
                  marginBottom: 4,
                }}
              />
            ) : (
              <div style={{ height: 58 }} />
            )}
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.25)",
                paddingTop: 8,
                fontWeight: 700,
                fontSize: 16,
                color: ink,
              }}
            >
              {branding.signatoryName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: muted,
                marginTop: 3,
                letterSpacing: "1px",
              }}
            >
              {branding.signatoryTitle}
            </div>
          </div>
        )}

        {/* QR */}
        <div>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: 10,
              display: "inline-block",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <QRCodeCanvas
              value={verifyUrl}
              size={104}
              fgColor="#0a0a0a"
              bgColor="#ffffff"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Responsive wrapper: renders the 1280×905 design scaled to the container
 * width. `captureRef` (optional) points at the unscaled design node so callers
 * can feed it straight to the PDF exporter at full resolution.
 */
export function CertificateView({
  cert,
  branding,
  verifyUrl,
  captureRef,
  className,
}: {
  cert: CertificateData;
  branding?: CertificateBranding | null;
  verifyUrl: string;
  captureRef?: Ref<HTMLDivElement>;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const b = branding ?? DEFAULT_CERTIFICATE_BRANDING;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(w > 0 ? Math.min(1, w / CERTIFICATE_W) : 1);
    };
    update();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const s = scale || 1;

  return (
    <div ref={wrapRef} className={className}>
      <div style={{ height: Math.round(CERTIFICATE_H * s), position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `scale(${s})`,
            transformOrigin: "top left",
            width: CERTIFICATE_W,
            height: CERTIFICATE_H,
          }}
        >
          <div ref={captureRef} style={{ width: CERTIFICATE_W, height: CERTIFICATE_H }}>
            <CertificateTemplate cert={cert} branding={b} verifyUrl={verifyUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
