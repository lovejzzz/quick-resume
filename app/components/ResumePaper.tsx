"use client";

import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { InlineEdit } from "./InlineEdit";
import { resumeFitVariables } from "../lib/fit";
import { getPageGeometry } from "../lib/page-size";
import { getResumeFont } from "../lib/resume-fonts";
import type { ResumeData, ResumeEntry, ResumeSection, ResumeStyle } from "../lib/resume-model";

export type ActiveText = { id: string; label: string; top: number };

export type ResumePaperProps = {
  activeText: ActiveText | null;
  data: ResumeData;
  draggingPhoto: boolean;
  onActivateText: (id: string, label: string, top: number) => void;
  onAdjustFont: (amount: number | "reset") => void;
  onPhotoKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onPhotoPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPhotoPointerFinish: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPhotoPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onUpdateContact: (key: keyof Omit<ResumeData, "sections">, value: string) => void;
  onUpdateEntry: (sectionId: string, entryId: string, patch: Partial<ResumeEntry>) => void;
  onUpdateSection: (sectionId: string, patch: Partial<ResumeSection>) => void;
  paperRef: RefObject<HTMLDivElement | null>;
  photoRef: RefObject<HTMLButtonElement | null>;
  style: ResumeStyle;
};

export function ResumePaper({
  activeText,
  data,
  draggingPhoto,
  onActivateText,
  onAdjustFont,
  onPhotoKeyDown,
  onPhotoPointerDown,
  onPhotoPointerFinish,
  onPhotoPointerMove,
  onUpdateContact,
  onUpdateEntry,
  onUpdateSection,
  paperRef,
  photoRef,
  style,
}: ResumePaperProps) {
  const geometry = getPageGeometry(style.pageSize);
  const selectedFont = getResumeFont(style.resumeFont);

  const inlineProps = (id: string, fontBase: string) => ({
    editId: id,
    fontAdjustment: style.fontAdjustments[id] || 0,
    fontBase,
    onActivate: onActivateText,
  });

  const updateBullet = (section: ResumeSection, entry: ResumeEntry, index: number, value: string) => {
    const bullets = [...entry.bullets];
    bullets[index] = value;
    onUpdateEntry(section.id, entry.id, { bullets });
  };

  return (
    <div
      className={`resume-paper layout-${style.layout} font-${style.font} density-${style.density} page-${style.pageSize}${
        draggingPhoto ? " photo-is-dragging" : ""
      }`}
      ref={paperRef}
      style={
        {
          "--resume-accent": style.accent,
          "--resume-font-family": selectedFont.stack,
          "--page-width": `${geometry.widthPx}px`,
          "--page-height": `${geometry.heightPx}px`,
          ...resumeFitVariables(style),
        } as CSSProperties
      }
    >
      {style.showPhoto && data.photo && (
        <button
          aria-label={`Move ${data.name || "resume"} photo. Drag anywhere on the page, or use arrow keys for precise movement.`}
          className="resume-photo"
          onKeyDown={onPhotoKeyDown}
          onLostPointerCapture={onPhotoPointerFinish}
          onPointerCancel={onPhotoPointerFinish}
          onPointerDown={onPhotoPointerDown}
          onPointerMove={onPhotoPointerMove}
          onPointerUp={onPhotoPointerFinish}
          ref={photoRef}
          style={{
            height: `${style.photoSize}px`,
            left: `${style.photoX}px`,
            top: `${style.photoY}px`,
            width: `${style.photoSize}px`,
          }}
          title="Drag anywhere · Arrow keys move precisely · Shift moves faster"
          type="button"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- user data URL, not an optimizable asset */}
          <img alt="" draggable={false} height={style.photoSize} src={data.photo} width={style.photoSize} />
          <span aria-hidden="true" className="photo-move-glyph">
            ↗
          </span>
        </button>
      )}

      <header className="resume-header">
        <div className="resume-identity" data-photo-flow="">
          <InlineEdit
            {...inlineProps("contact:name", "var(--name-size, 34px)")}
            as="h2"
            label="Name"
            onCommit={(value) => onUpdateContact("name", value)}
            placeholder="Your Name"
            value={data.name}
          />
          <InlineEdit
            {...inlineProps("contact:headline", "var(--headline-size, 13px)")}
            as="p"
            className="resume-headline"
            label="Professional headline"
            onCommit={(value) => onUpdateContact("headline", value)}
            placeholder="Professional headline"
            value={data.headline}
          />
          <div className="contact-line">
            {(
              [
                ["email", data.email],
                ["phone", data.phone],
                ["location", data.location],
                ["portfolio", data.portfolio],
                ["secondaryLink", data.secondaryLink],
              ] as const
            )
              .filter(([, item]) => Boolean(item))
              .map(([key, item]) => (
                <InlineEdit
                  {...inlineProps(`contact:${key}`, "var(--contact-size, 10px)")}
                  as="span"
                  key={key}
                  label={key === "secondaryLink" ? "Additional link" : key}
                  onCommit={(value) => onUpdateContact(key, value)}
                  value={item}
                />
              ))}
          </div>
        </div>
      </header>

      <div className="resume-body">
        {data.sections.map((section) => (
          <section className={`resume-section kind-${section.kind}`} key={section.id}>
            <InlineEdit
              {...inlineProps(`section:${section.id}:title`, "var(--section-title-size, 11px)")}
              as="h3"
              label={`${section.title} section title`}
              onCommit={(value) => onUpdateSection(section.id, { title: value })}
              photoFlow
              placeholder="Section title"
              value={section.title}
            />

            {section.kind === "summary" ? (
              <InlineEdit
                {...inlineProps(
                  `entry:${section.entries[0]?.id || section.id}:details`,
                  "var(--paper-font-size, 12px)",
                )}
                as="p"
                className="summary-text"
                label="Professional summary"
                multiline
                onCommit={(value) => {
                  const entry = section.entries[0];
                  if (entry) onUpdateEntry(section.id, entry.id, { details: value });
                }}
                photoFlow
                placeholder="Click to write a professional summary"
                value={section.entries[0]?.details || ""}
              />
            ) : section.kind === "skills" ? (
              <div className="skill-list" data-photo-flow="">
                {section.entries.map((entry) => (
                  <div className="skill-row" key={entry.id}>
                    <InlineEdit
                      {...inlineProps(`entry:${entry.id}:heading`, "var(--skill-text-size, 10px)")}
                      as="strong"
                      label="Skill category"
                      onCommit={(value) => onUpdateEntry(section.id, entry.id, { heading: value })}
                      placeholder="Category"
                      value={entry.heading}
                    />
                    <InlineEdit
                      {...inlineProps(`entry:${entry.id}:details`, "var(--skill-text-size, 10px)")}
                      as="span"
                      label={`${entry.heading || "Skill"} details`}
                      onCommit={(value) => onUpdateEntry(section.id, entry.id, { details: value })}
                      placeholder="Skills"
                      value={entry.details}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="resume-entry-list">
                {section.entries.map((entry) => (
                  <article className="resume-entry" data-photo-flow="" key={entry.id}>
                    <div className="resume-entry-heading">
                      <div>
                        <InlineEdit
                          {...inlineProps(`entry:${entry.id}:heading`, "var(--entry-title-size, 13px)")}
                          as="h4"
                          label={`${section.title} item title`}
                          onCommit={(value) => onUpdateEntry(section.id, entry.id, { heading: value })}
                          placeholder="Item title"
                          value={entry.heading}
                        />
                        {entry.subheading && (
                          <InlineEdit
                            {...inlineProps(`entry:${entry.id}:subheading`, "var(--entry-subtitle-size, 11px)")}
                            as="p"
                            label={`${entry.heading} supporting information`}
                            onCommit={(value) => onUpdateEntry(section.id, entry.id, { subheading: value })}
                            value={entry.subheading}
                          />
                        )}
                      </div>
                      {entry.date && (
                        <InlineEdit
                          {...inlineProps(`entry:${entry.id}:date`, "var(--entry-date-size, 10px)")}
                          as="time"
                          label={`${entry.heading} date`}
                          onCommit={(value) => onUpdateEntry(section.id, entry.id, { date: value })}
                          value={entry.date}
                        />
                      )}
                    </div>
                    {entry.link && (
                      <InlineEdit
                        {...inlineProps(`entry:${entry.id}:link`, "var(--entry-link-size, 9.5px)")}
                        as="p"
                        className="entry-link"
                        label={`${entry.heading} link`}
                        onCommit={(value) => onUpdateEntry(section.id, entry.id, { link: value })}
                        value={entry.link}
                      />
                    )}
                    {entry.details && (
                      <InlineEdit
                        {...inlineProps(`entry:${entry.id}:details`, "var(--entry-text-size, 10.5px)")}
                        as="p"
                        className="entry-details"
                        label={`${entry.heading} details`}
                        multiline
                        onCommit={(value) => onUpdateEntry(section.id, entry.id, { details: value })}
                        value={entry.details}
                      />
                    )}
                    {entry.bullets.some((bullet) => bullet.trim()) && (
                      <ul>
                        {entry.bullets.map((bullet, index) =>
                          bullet.trim() ? (
                            <InlineEdit
                              {...inlineProps(`entry:${entry.id}:bullet:${index}`, "var(--entry-text-size, 10.5px)")}
                              as="li"
                              key={index}
                              label={`${entry.heading} bullet ${index + 1}`}
                              multiline
                              onCommit={(value) => updateBullet(section, entry, index, value)}
                              value={bullet}
                            />
                          ) : null,
                        )}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {activeText && (
        <div
          aria-label={`Font size controls for ${activeText.label}`}
          className="inline-font-tools no-print"
          data-font-tools=""
          data-html2canvas-ignore="true"
          onMouseDown={(event) => event.preventDefault()}
          role="group"
          style={{ top: `${activeText.top}px` }}
        >
          <button
            aria-label={`Decrease font size for ${activeText.label}`}
            onClick={() => onAdjustFont(-1)}
            title="Decrease font size"
            type="button"
          >
            −
          </button>
          <button
            aria-label={`Increase font size for ${activeText.label}`}
            onClick={() => onAdjustFont(1)}
            title="Increase font size"
            type="button"
          >
            +
          </button>
          <button
            aria-label={`Reset font size for ${activeText.label}`}
            disabled={!style.fontAdjustments[activeText.id]}
            onClick={() => onAdjustFont("reset")}
            title="Reset font size"
            type="button"
          >
            ↺
          </button>
        </div>
      )}
    </div>
  );
}
