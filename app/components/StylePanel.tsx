"use client";

import { useRef, type ChangeEvent } from "react";
import { judgeAccent } from "../lib/contrast";
import { pageGeometries } from "../lib/page-size";
import { getResumeFont, resumeFonts } from "../lib/resume-fonts";
import type { PageSize, ResumeData, ResumeLayout, ResumeStyle } from "../lib/resume-model";
import { resumeThemes } from "../lib/resume-themes";

export type StylePanelProps = {
  data: ResumeData;
  onApplyTheme: (layout: ResumeLayout) => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPlacePhoto: (placement: "left" | "center" | "right") => void;
  onRemovePhoto: () => void;
  onReset: () => void;
  photoError: string;
  setStyle: (update: (current: ResumeStyle) => ResumeStyle) => void;
  style: ResumeStyle;
};

export function StylePanel({
  data,
  onApplyTheme,
  onPhotoChange,
  onPlacePhoto,
  onRemovePhoto,
  onReset,
  photoError,
  setStyle,
  style,
}: StylePanelProps) {
  const fontMenuRef = useRef<HTMLDetailsElement>(null);
  const selectedFont = getResumeFont(style.resumeFont);
  const accentVerdict = judgeAccent(style.accent);

  return (
    <section className="panel-block style-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Presentation</p>
          <h2>Choose your layout</h2>
        </div>
      </div>

      <fieldset aria-label="Resume layouts" className="choice-group">
        <div className="theme-grid">
          {resumeThemes.map((theme) => (
            <button
              aria-pressed={style.layout === theme.id}
              className={style.layout === theme.id ? "theme-card selected" : "theme-card"}
              key={theme.id}
              onClick={() => onApplyTheme(theme.id)}
              type="button"
            >
              <span aria-hidden="true" className={`theme-swatch theme-swatch-${theme.id}`}>
                <i />
                <i />
                <i />
              </span>
              <span className="theme-card-copy">
                <strong>{theme.label}</strong>
                <small>{theme.bestFor}</small>
                <span>{theme.description}</span>
              </span>
              <span aria-hidden="true" className="theme-check">
                ✓
              </span>
            </button>
          ))}
        </div>
        <p className="theme-guidance">
          All five keep standard headings, readable type, and a single-column content flow. Choosing one also
          arranges sections around that job context; you can still reorder them.
        </p>
      </fieldset>

      <fieldset className="choice-group">
        <legend>Page size</legend>
        <div className="segmented page-size-segmented">
          {pageGeometries.map((geometry) => (
            <button
              aria-pressed={style.pageSize === geometry.id}
              className={style.pageSize === geometry.id ? "selected" : ""}
              key={geometry.id}
              onClick={() => setStyle((current) => ({ ...current, pageSize: geometry.id as PageSize }))}
              type="button"
            >
              <strong>{geometry.label}</strong>
              <small>{geometry.note}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="choice-group font-choice-group">
        <legend>Resume font</legend>
        <details className="font-picker" ref={fontMenuRef}>
          <summary style={{ fontFamily: selectedFont.stack }}>
            <span>
              <strong>{selectedFont.label}</strong>
              <small>{selectedFont.note}</small>
            </span>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="font-picker-menu">
            <div className="font-picker-intro">
              <strong>30 professional fonts</strong>
              <span>Ordered by how often they appear in current ATS-safe resume guidance.</span>
            </div>
            <div className="font-option-list">
              {resumeFonts.map((font, index) => (
                <button
                  aria-pressed={style.resumeFont === font.id}
                  className={style.resumeFont === font.id ? "selected" : ""}
                  key={font.id}
                  onClick={() => {
                    setStyle((current) => ({ ...current, resumeFont: font.id }));
                    fontMenuRef.current?.removeAttribute("open");
                  }}
                  style={{ fontFamily: font.stack }}
                  type="button"
                >
                  <span className="font-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="font-sample">Ag</span>
                  <span className="font-option-copy">
                    <strong>{font.label}</strong>
                    <small>{font.note}</small>
                  </span>
                  <span aria-hidden="true" className="font-option-check">
                    ✓
                  </span>
                </button>
              ))}
            </div>
          </div>
        </details>
        <p className="font-picker-note">
          The first choices are the safest defaults. Every option stays selectable text in PDF export.
        </p>
      </fieldset>

      <fieldset className="choice-group">
        <legend>Spacing</legend>
        <div className="segmented">
          {(["comfortable", "compact"] as const).map((value) => (
            <button
              aria-pressed={style.density === value}
              className={style.density === value ? "selected" : ""}
              key={value}
              onClick={() => setStyle((current) => ({ ...current, density: value }))}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="color-field-wrap">
        <label className="field color-field">
          <span>Accent color</span>
          <div>
            <input
              aria-label="Accent color"
              onChange={(event) => setStyle((current) => ({ ...current, accent: event.target.value }))}
              type="color"
              value={style.accent}
            />
            <input
              aria-label="Accent color hex value"
              onChange={(event) => setStyle((current) => ({ ...current, accent: event.target.value }))}
              value={style.accent}
            />
          </div>
        </label>
        {accentVerdict && accentVerdict.level !== "pass" && (
          <p className={`accent-warning tone-${accentVerdict.level}`} role="status">
            {accentVerdict.message}
          </p>
        )}
      </div>

      <div className="photo-control-card">
        <div className="photo-control-heading">
          {data.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- user data URL
            <img alt="Uploaded resume photo preview" height="54" src={data.photo} width="54" />
          ) : (
            <span aria-hidden="true" className="photo-placeholder">
              Photo
            </span>
          )}
          <span>
            <strong>Resume photo</strong>
            <small>PNG or JPG; cropped automatically</small>
          </span>
        </div>
        <div className="photo-action-row">
          <label className="photo-upload-action">
            {data.photo ? "Replace photo" : "Upload photo"}
            <input accept="image/png,image/jpeg" onChange={onPhotoChange} type="file" />
          </label>
          {data.photo && (
            <button className="photo-remove-action" onClick={onRemovePhoto} type="button">
              Remove
            </button>
          )}
        </div>
        {photoError && (
          <p className="photo-error" role="alert">
            {photoError}
          </p>
        )}
        <label className="toggle-row photo-toggle">
          <span>
            <strong>Show photo</strong>
            <small>{data.photo ? "Include the uploaded photo" : "Upload a photo to enable this"}</small>
          </span>
          <input
            checked={style.showPhoto && Boolean(data.photo)}
            disabled={!data.photo}
            onChange={(event) => setStyle((current) => ({ ...current, showPhoto: event.target.checked }))}
            type="checkbox"
          />
        </label>
        {data.photo && style.showPhoto && (
          <fieldset className="photo-position-control">
            <legend>Quick placement</legend>
            <div className="segmented">
              {(["left", "center", "right"] as const).map((position) => (
                <button key={position} onClick={() => onPlacePhoto(position)} type="button">
                  {position}
                </button>
              ))}
            </div>
            <small>
              Drag the photo anywhere on the page. Nearby text makes room automatically; arrow keys offer precise
              movement.
            </small>
          </fieldset>
        )}
      </div>

      <button className="secondary-button" onClick={onReset} type="button">
        Reset starter content
      </button>
    </section>
  );
}
