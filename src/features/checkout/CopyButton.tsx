"use client";

import { useState, useEffect } from "react";
import { CopyIcon, CheckIcon } from "./Icons";

interface CopyButtonProps {
  text: string;
  label?: string;
  subject?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CopyButton({
  text,
  label = "Salin",
  subject = "Nomor rekening",
  className = "",
  style,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
      setShowToast(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setShowToast(true);
    } catch {
      // Fallback
      setCopied(true);
      setShowToast(true);
    }
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`${label} ${subject} ${text}`}
        className={`copy-btn ${copied ? "copy-btn-success" : ""} ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.25rem 0.625rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          borderRadius: "9999px",
          border: copied ? "1px solid #16a34a" : "1px solid var(--border)",
          backgroundColor: copied ? "#f0fdf4" : "var(--surface)",
          color: copied ? "#15803d" : "var(--foreground)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          lineHeight: 1.4,
          ...style,
        }}
        title={`Salin ${subject}`}
      >
        {copied ? (
          <>
            <CheckIcon size={14} style={{ color: "#16a34a" }} />
            <span>Tersalin!</span>
          </>
        ) : (
          <>
            <CopyIcon size={14} style={{ opacity: 0.8 }} />
            <span>{label}</span>
          </>
        )}
      </button>

      {/* Floating toast notification when copied */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#1e293b",
            color: "#ffffff",
            padding: "0.375rem 0.75rem",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 500,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 50,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <CheckIcon size={13} style={{ color: "#4ade80" }} />
          <span>{subject} berhasil disalin!</span>
        </div>
      )}
    </div>
  );
}
