import React, { useState } from "react";
import { ClipboardCheck } from "lucide-react";

interface CopyableFieldProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  input?: boolean;
  copiedTop?: boolean;
}

export function CopyableField({ value, children, className = "", input = false, copiedTop = false }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div
      className={`relative group flex items-center ${input ? "w-fit" : ""} ${className}`}
      tabIndex={0}
      role="button"
      title="Clique para copiar"
      onClick={handleCopy}
      style={{ cursor: "pointer" }}
    >
      {children}
      {copied && (
        <span
          className={`ml-2 flex items-center gap-1 text-green-600 text-xs animate-fade-in z-10`}
        >
          <ClipboardCheck size={16} /> Copiado!
        </span>
      )}
    </div>
  );
}
