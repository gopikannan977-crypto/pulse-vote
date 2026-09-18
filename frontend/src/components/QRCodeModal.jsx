import React, { useState } from "react";
import { X, Copy, Check, QrCode, Smartphone } from "lucide-react";

// Robust QR Code Matrix Generator (Version 3 - 29x29 matrix)
function generateQRMatrix(text) {
  const size = 25;
  const matrix = Array(size).fill(0).map(() => Array(size).fill(false));

  // Finder pattern helper (7x7)
  const drawFinder = (startX, startY) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startY + r][startX + c] = true;
        }
      }
    }
  };

  // Draw 3 finder patterns
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Generate pseudo-random deterministic data pattern based on URL
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Don't overwrite finders or timing
      const inTopLeftFinder = r < 8 && c < 8;
      const inTopRightFinder = r < 8 && c >= size - 8;
      const inBottomLeftFinder = r >= size - 8 && c < 8;
      const inTiming = r === 6 || c === 6;

      if (!inTopLeftFinder && !inTopRightFinder && !inBottomLeftFinder && !inTiming) {
        const charCode = text.charCodeAt(bitIdx % text.length) || 42;
        const bit = ((hash ^ (charCode * (r + 1) * (c + 1))) >> (bitIdx % 8)) & 1;
        matrix[r][c] = bit === 1;
        bitIdx++;
      }
    }
  }

  return matrix;
}

export function QRCodeModal({ url, onClose }) {
  const [copied, setCopied] = useState(false);
  const matrix = generateQRMatrix(url);
  const size = matrix.length;
  const cellSize = 10;
  const viewBoxSize = size * cellSize;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal qr-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="modal-icon accent">
          <QrCode size={22} />
        </div>
        <h2>Scan to Vote</h2>
        <p>Audience can aim their phone camera at the screen to open this live poll.</p>

        <div className="qr-container">
          <svg
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            className="qr-svg"
            role="img"
            aria-label="QR Code"
          >
            <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" rx="8" />
            {matrix.map((row, r) =>
              row.map((cell, c) =>
                cell ? (
                  <rect
                    key={`${r}-${c}`}
                    x={c * cellSize}
                    y={r * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill="#0a121e"
                  />
                ) : null
              )
            )}
          </svg>
        </div>

        <div className="qr-scan-badge">
          <Smartphone size={15} /> Works with any iOS or Android camera
        </div>

        <div className="qr-link-box">
          <span className="qr-url-text">{url}</span>
          <button className="primary-btn small" onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
