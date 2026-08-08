import { useEffect, useRef, useState, type Ref } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatDate } from "@/lib/format";

/**
 * Certificate template + responsive viewer.
 *
 * The template is rendered at a fixed 1280×905 design size using ONLY inline
 * styles with hex colors, so it rasterizes pixel-perfectly to a PDF via
 * html2canvas (Tailwind v4 oklch tokens are deliberately avoided here).
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
  const ink = "#171a1e";
  const muted = "#5b6169";
  const paper = "#f7f5ee";

  const corners = [
    { top: 34, left: 34 },
    { top: 34, right: 34 },
    { bottom: 34, left: 34 },
    { bottom: 34, right: 34 },
  ];

  return (
    <div
      style={{
        width: CERTIFICATE_W,
        height: CERTIFICATE_H,
        background: paper,
        color: ink,
        fontFamily: "Georgia, 'Times New Roman', serif",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Frames */}
      <div
        style={{
          position: "absolute",
          inset: 20,
          border: `3px solid ${accent}`,
          borderRadius: 14,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 30,
          border: "1px solid rgba(23,26,30,0.4)",
          borderRadius: 8,
        }}
      />
      {corners.map((c, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            background: accent,
            ...c,
          }}
        />
      ))}

      {/* Brand header */}
      <div
        style={{
          position: "absolute",
          top: 66,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 120px",
        }}
      >
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            style={{ height: 70, objectFit: "contain", maxWidth: 260 }}
          />
        ) : (
          <span style={{ fontSize: 54, color: accent, lineHeight: 1 }}>✦</span>
        )}
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "6px",
            textTransform: "uppercase",
            marginTop: 10,
          }}
        >
          {branding.institutionName}
        </div>
        <div
          style={{
            fontSize: 16,
            fontStyle: "italic",
            letterSpacing: "1px",
            color: muted,
            marginTop: 5,
          }}
        >
          {branding.motto}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          position: "absolute",
          top: 232,
          left: 230,
          right: 230,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ flex: 1, height: 1, background: accent }} />
        <span style={{ fontSize: 16, color: accent }}>✦</span>
        <div style={{ flex: 1, height: 1, background: accent }} />
      </div>

      {/* Body */}
      <div
        style={{
          position: "absolute",
          top: 254,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 150px",
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: "4px",
            textTransform: "uppercase",
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
          This is proudly presented to
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            marginTop: 10,
            lineHeight: 1.15,
            overflowWrap: "break-word",
          }}
        >
          {cert.studentName}
        </div>
        <div
          style={{
            width: 250,
            height: 2,
            background: accent,
            margin: "16px auto 0",
          }}
        />
        <div
          style={{
            fontSize: 19,
            fontStyle: "italic",
            color: muted,
            marginTop: 16,
          }}
        >
          for successfully completing the course
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: accent,
            marginTop: 8,
            overflowWrap: "break-word",
          }}
        >
          {cert.courseTitle}
        </div>
        <div style={{ fontSize: 16, color: muted, marginTop: 22 }}>
          Awarded on {formatDate(cert.issuedAt)}
        </div>
      </div>

      {/* Footer row */}
      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: 140,
          right: 140,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        {/* Signature */}
        <div style={{ textAlign: "center", width: 300 }}>
          {branding.signatureUrl ? (
            <img
              src={branding.signatureUrl}
              alt=""
              style={{
                height: 62,
                objectFit: "contain",
                maxWidth: 300,
                marginBottom: 4,
              }}
            />
          ) : (
            <div style={{ height: 66 }} />
          )}
          <div
            style={{
              borderTop: "1.5px solid rgba(23,26,30,0.5)",
              paddingTop: 8,
              fontWeight: 700,
              fontSize: 19,
            }}
          >
            {branding.signatoryName || "Signature"}
          </div>
          <div
            style={{
              fontSize: 13,
              color: muted,
              marginTop: 3,
              letterSpacing: "0.5px",
            }}
          >
            {branding.signatoryTitle}
          </div>
        </div>

        {/* QR */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(23,26,30,0.25)",
              borderRadius: 10,
              padding: 10,
              display: "inline-block",
            }}
          >
            <QRCodeSVG value={verifyUrl} size={108} fgColor={ink} bgColor="#ffffff" />
          </div>
          <div style={{ fontSize: 12, color: muted, marginTop: 6, maxWidth: 200 }}>
            Scan to verify this credential online
          </div>
        </div>

        {/* Verify URL + ID */}
        <div style={{ textAlign: "right", width: 300, fontSize: 13, color: muted, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: ink, letterSpacing: "0.5px" }}>
            Verify at
          </div>
          <div style={{ wordBreak: "break-all" }}>{verifyUrl}</div>
          <div
            style={{
              marginTop: 10,
              borderTop: "1px solid rgba(23,26,30,0.2)",
              paddingTop: 8,
            }}
          >
            <span style={{ fontWeight: 700, color: ink, letterSpacing: "0.5px" }}>
              Certificate ID
            </span>
            <br />
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {cert.certificateId}
            </span>
          </div>
        </div>
      </div>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 12,
          letterSpacing: "3px",
          color: "rgba(23,26,30,0.45)",
        }}
      >
        {branding.institutionName.toUpperCase()} · OFFICIAL CREDENTIAL
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
