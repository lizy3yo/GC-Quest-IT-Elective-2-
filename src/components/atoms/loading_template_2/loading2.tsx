"use client";

import React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export default function LoadingTemplate2({ title = "", subtitle = "", compact = false }: Props) {
  return (
    <div className={`min-h-screen p-6 flex items-center justify-center loading2-root ${compact ? "py-12" : ""}`} role="status" aria-live="polite">
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 mx-auto mb-4"
          style={{ borderColor: "transparent", borderBottomColor: "#1C2B1C" }}
          aria-hidden="true"
        ></div>

  <p className="text-lg text-[\#1C2B1C]">{title}</p>

  {subtitle ? <p className="text-sm mt-2 text-[\#1C2B1C] opacity-90">{subtitle}</p> : null}
      </div>
    </div>
  );
}
