"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { EXPORT_QUALITY_LEVELS, getExportQuality } from "../lib/export-quality";
import { formatBytes } from "../lib/fit";
import { getPageGeometry } from "../lib/page-size";
import type { ResumeData, ResumeStyle } from "../lib/resume-model";

export type ExportFormat = "png" | "jpg" | "pdf";

export type ExportPanelProps = {
  autoFitting: boolean;
  data: ResumeData;
  exportError: string;
  exporting: boolean;
  onAutoFit: () => void;
  onExport: (format: ExportFormat, options: { scale: number; quality: number }) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => Promise<{ ok: boolean; reason?: string; count?: number }>;
  pageCount: number;
  paperHeight: number;
  setStyle: (update: (current: ResumeStyle) => ResumeStyle) => void;
  style: ResumeStyle;
};

export function ExportPanel({
  autoFitting,
  data,
  exportError,
  exporting,
  onAutoFit,
  onExport,
  onExportBackup,
  onImportBackup,
  pageCount,
  paperHeight,
  setStyle,
  style,
}: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [qualityLevel, setQualityLevel] = useState(7);
  const [backupMessage, setBackupMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const geometry = getPageGeometry(style.pageSize);
  const quality = getExportQuality(qualityLevel);

  const textLength = useMemo(() => JSON.stringify(data).length, [data]);
  const estimatedBytes = useMemo(() => {
    const pixels = geometry.widthPx * paperHeight * quality.scale * quality.scale;
    const density = Math.min(1, textLength / 9000);
    const photoBytes = data.photo ? Math.floor((data.photo.length * 3) / 4) : 0;
    if (format === "png") return pixels * (0.1 + density * 0.09) + photoBytes * 0.7;
    if (format === "jpg") {
      return pixels * (0.045 + density * 0.05) * quality.jpegQuality + photoBytes * 0.45;
    }
    return 70000 + textLength * 9 + pageCount * 38000 + photoBytes * 0.25;
  }, [data.photo, format, geometry.widthPx, pageCount, paperHeight, quality.jpegQuality, quality.scale, textLength]);

  const outputDimensions =
    format === "pdf"
      ? `${geometry.note.split(" — ")[0]} · ${pageCount} ${pageCount === 1 ? "page" : "pages"}`
      : `≈ ${Math.round(geometry.widthPx * quality.scale).toLocaleString()} × ${Math.round(
          paperHeight * quality.scale,
        ).toLocaleString()} px`;

  const handleBackupImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const result = await onImportBackup(file);
    input.value = "";
    setBackupMessage(
      result.ok
        ? { tone: "ok", text: `Restored ${result.count} resume${result.count === 1 ? "" : "s"}. Save to keep them.` }
        : { tone: "error", text: result.reason ?? "That backup could not be read." },
    );
  };

  return (
    <section className="panel-block export-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Output</p>
          <h2>Download your resume</h2>
        </div>
      </div>

      <div className="smart-fit-card">
        <div className="smart-fit-heading">
          <span>
            <strong>Smart one-page fit</strong>
            <small>Spacing first, typography last</small>
          </span>
          <output>{style.fitLevel}%</output>
        </div>
        <input
          aria-label="Smart one-page fit strength"
          className="smart-fit-slider"
          disabled={autoFitting}
          max="100"
          min="0"
          onChange={(event) => setStyle((current) => ({ ...current, fitLevel: Number(event.target.value) }))}
          step="1"
          type="range"
          value={style.fitLevel}
        />
        <div className="smart-fit-scale">
          <span>Roomy</span>
          <span className={pageCount === 1 ? "fit-status success" : "fit-status"}>
            {pageCount === 1 ? `Fits one ${geometry.label} page` : `${pageCount} pages`}
          </span>
          <span>Maximum fit</span>
        </div>
        <button className="fit-action" disabled={autoFitting} onClick={onAutoFit} type="button">
          {autoFitting ? "Finding the best fit…" : "Find the lightest one-page fit"}
        </button>
        <p>
          Nothing is removed. Smart fit tightens gaps and margins before making small, readability-safe type
          adjustments.
        </p>
      </div>

      <div aria-label="Export format" className="format-grid" role="radiogroup">
        {(
          [
            ["pdf", "PDF", "Best for applications"],
            ["png", "PNG", "Sharp image"],
            ["jpg", "JPG", "Smaller image"],
          ] as const
        ).map(([value, label, note], index, formats) => (
          <button
            aria-checked={format === value}
            className={format === value ? "format-card selected" : "format-card"}
            key={value}
            onKeyDown={(event) => {
              const direction =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : 0;
              if (!direction) return;
              event.preventDefault();
              const nextIndex = (index + direction + formats.length) % formats.length;
              setFormat(formats[nextIndex][0]);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]',
              );
              buttons?.[nextIndex]?.focus();
            }}
            onClick={() => setFormat(value)}
            role="radio"
            tabIndex={format === value ? 0 : -1}
            type="button"
          >
            <strong>{label}</strong>
            <span>{note}</span>
          </button>
        ))}
      </div>

      {format !== "pdf" && (
        <label className="field range-field export-quality-field">
          <span>
            Export quality
            <strong>
              Level {quality.level}/{EXPORT_QUALITY_LEVELS} · {quality.label}
            </strong>
          </span>
          <input
            aria-label="Export quality level"
            max={EXPORT_QUALITY_LEVELS}
            min="1"
            onChange={(event) => setQualityLevel(Number(event.target.value))}
            step="1"
            type="range"
            value={quality.level}
          />
          <span className="quality-scale" aria-hidden="true">
            <small>1 · Smaller file</small>
            <small>12 · Maximum detail</small>
          </span>
        </label>
      )}

      <div className="estimate-card">
        <div>
          <span>Estimated {format.toUpperCase()} size</span>
          <strong>≈ {formatBytes(estimatedBytes)}</strong>
        </div>
        <div>
          <span>Output dimensions</span>
          <strong>{outputDimensions}</strong>
        </div>
      </div>

      {format === "pdf" && (
        <p className="export-note">
          PDF opens the print dialog. Choose “Save as PDF” for selectable text and better applicant-system
          compatibility. Its final compression is controlled by your browser; the 12-level quality control is
          available for PNG and JPG, where every level reliably changes the output.
        </p>
      )}

      <button
        className="primary-button"
        disabled={autoFitting || exporting}
        onClick={() =>
          onExport(format, { scale: quality.scale, quality: quality.jpegQuality })
        }
        type="button"
      >
        {autoFitting
          ? "Finishing Smart Fit…"
          : exporting
            ? "Preparing file…"
            : format === "pdf"
              ? "Open PDF export"
              : `Download ${format.toUpperCase()}`}
      </button>
      {exportError && <p className="import-message error" role="alert">{exportError}</p>}
      <p className="fine-print">
        The estimate changes with format, resolution, content, and photos. Final size may vary.
      </p>

      <div className="backup-card">
        <div>
          <strong>Back up everything</strong>
          <small>
            Downloads every resume as a JSON file. Keep it somewhere safe — clearing your browser erases the
            editor&rsquo;s only copy.
          </small>
        </div>
        <div className="backup-actions">
          <button className="secondary-button" onClick={onExportBackup} type="button">
            Download backup
          </button>
          <label className="backup-restore">
            Restore backup
            <input accept=".json,application/json" onChange={handleBackupImport} ref={backupInputRef} type="file" />
          </label>
        </div>
        {backupMessage && (
          <p className={backupMessage.tone === "error" ? "import-message error" : "import-message"} role="status">
            {backupMessage.text}
          </p>
        )}
      </div>
    </section>
  );
}
