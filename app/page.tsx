"use client";

import {
  ChangeEvent,
  DragEvent,
  ElementType,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";

type SectionKind = "summary" | "experience" | "projects" | "education" | "skills" | "awards" | "custom";

type ResumeEntry = {
  id: string;
  heading: string;
  subheading: string;
  date: string;
  details: string;
  bullets: string[];
  link?: string;
};

type ResumeSection = {
  id: string;
  kind: SectionKind;
  title: string;
  entries: ResumeEntry[];
};

type ResumeData = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  portfolio: string;
  secondaryLink: string;
  photo: string;
  sections: ResumeSection[];
};

type ResumeStyle = {
  accent: string;
  font: "modern" | "classic" | "humanist";
  density: "comfortable" | "compact";
  showPhoto: boolean;
};

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const initialData: ResumeData = {
  name: "Tian Xing",
  headline: "Educational Technologist | Learning Experience Designer",
  email: "tx845@nyu.edu",
  phone: "(551) 414-5977",
  location: "",
  portfolio: "xingpicture.myportfolio.com",
  secondaryLink: "@xing_tian_lifeitself",
  photo: "",
  sections: [
    {
      id: "summary",
      kind: "summary",
      title: "Profile",
      entries: [
        {
          id: "summary-1",
          heading: "",
          subheading: "",
          date: "",
          details:
            "Educational technologist and learning experience designer with interdisciplinary expertise in educational game design, AI-enabled workflows, multimedia production, and music education. Experienced in LMS administration, instructional support, automation, and the design of interactive learning tools.",
          bullets: [],
        },
      ],
    },
    {
      id: "experience",
      kind: "experience",
      title: "Experience",
      entries: [
        {
          id: "experience-1",
          heading: "Educational Technologist",
          subheading: "NYU Silver School",
          date: "2026–Present",
          details: "",
          bullets: [
            "Deliver instructional support and administer learning-management systems.",
            "Implement AI-enabled tools and workflow automations for educational use cases.",
          ],
        },
        {
          id: "experience-2",
          heading: "Music Tutor",
          subheading: "Berklee College of Music",
          date: "2021–2024",
          details: "",
          bullets: [
            "Provided individualized instruction in harmony, arranging, and piano improvisation.",
            "Used Logic Pro, MuseScore, and Finale to support music learning and composition.",
          ],
        },
      ],
    },
    {
      id: "projects",
      kind: "projects",
      title: "Selected Projects",
      entries: [
        {
          id: "project-1",
          heading: "EduTool.dev",
          subheading: "Founder & Developer",
          date: "",
          details: "Founded and developed an educational technology website.",
          bullets: [],
          link: "edutool.dev",
        },
        {
          id: "project-2",
          heading: "Surge Method",
          subheading: "iOS App Designer & Developer",
          date: "",
          details: "Designed and developed an iOS application focused on an original learning method.",
          bullets: [],
        },
      ],
    },
    {
      id: "education",
      kind: "education",
      title: "Education",
      entries: [
        {
          id: "education-1",
          heading: "New York University",
          subheading: "Master of Science, Games for Learning",
          date: "2024–2026",
          details: "",
          bullets: [],
        },
        {
          id: "education-2",
          heading: "Berklee College of Music",
          subheading: "Bachelor of Music, Jazz Composition",
          date: "2021–2024",
          details: "Scholarship recipient",
          bullets: [],
        },
        {
          id: "education-3",
          heading: "City University of New York",
          subheading: "Associate in Science, Music Studies",
          date: "2018–2020",
          details: "Pianist, CUNY Jazz Ensemble",
          bullets: [],
        },
      ],
    },
    {
      id: "skills",
      kind: "skills",
      title: "Skills",
      entries: [
        {
          id: "skill-1",
          heading: "Learning & AI",
          subheading: "",
          date: "",
          details: "Instructional support, LMS administration, AI implementation, workflow automation, Dify",
          bullets: [],
        },
        {
          id: "skill-2",
          heading: "Design & Media",
          subheading: "",
          date: "",
          details: "Figma, DaVinci Resolve, Final Cut Pro, Photoshop",
          bullets: [],
        },
        {
          id: "skill-3",
          heading: "Development",
          subheading: "",
          date: "",
          details: "JavaScript, Python",
          bullets: [],
        },
        {
          id: "skill-4",
          heading: "Music",
          subheading: "",
          date: "",
          details: "Logic Pro, MuseScore, Finale",
          bullets: [],
        },
      ],
    },
    {
      id: "awards",
      kind: "awards",
      title: "Awards",
      entries: [
        {
          id: "award-1",
          heading: "NYU Creative Excellence Award",
          subheading: "",
          date: "2026",
          details: "",
          bullets: [],
        },
        {
          id: "award-2",
          heading: "IPA Photography Bronze Award",
          subheading: "",
          date: "2017",
          details: "",
          bullets: [],
        },
      ],
    },
  ],
};

const initialStyle: ResumeStyle = {
  accent: "#28605d",
  font: "modern",
  density: "comfortable",
  showPhoto: false,
};

const sectionTemplates: Record<SectionKind, { title: string; entry: ResumeEntry }> = {
  summary: {
    title: "Profile",
    entry: { id: "", heading: "", subheading: "", date: "", details: "Write a focused professional summary.", bullets: [] },
  },
  experience: {
    title: "Experience",
    entry: { id: "", heading: "Role title", subheading: "Organization", date: "Dates", details: "", bullets: ["Describe an accomplishment or responsibility."] },
  },
  projects: {
    title: "Projects",
    entry: { id: "", heading: "Project name", subheading: "Your role", date: "", details: "Describe the project and its purpose.", bullets: [], link: "" },
  },
  education: {
    title: "Education",
    entry: { id: "", heading: "School", subheading: "Degree or program", date: "Dates", details: "", bullets: [] },
  },
  skills: {
    title: "Skills",
    entry: { id: "", heading: "Category", subheading: "", date: "", details: "Skill, Skill, Skill", bullets: [] },
  },
  awards: {
    title: "Awards",
    entry: { id: "", heading: "Award name", subheading: "", date: "Year", details: "", bullets: [] },
  },
  custom: {
    title: "New Section",
    entry: { id: "", heading: "Item title", subheading: "Supporting detail", date: "", details: "Add your information here.", bullets: [] },
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFilename(name: string) {
  return `${name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"}-resume`;
}

type InlineEditProps = {
  as?: ElementType;
  className?: string;
  label: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
  placeholder?: string;
  value: string;
};

function InlineEdit({
  as: Tag = "span",
  className,
  label,
  multiline = false,
  onCommit,
  placeholder = "",
  value,
}: InlineEditProps) {
  const elementRef = useRef<HTMLElement>(null);
  const isEditing = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || isEditing.current) return;
    const visibleValue = multiline ? element.innerText : element.textContent;
    if (visibleValue !== value) element.textContent = value;
  }, [multiline, value]);

  const finishEdit = () => {
    const element = elementRef.current;
    if (!element) return;
    isEditing.current = false;
    const rawValue = multiline ? element.innerText : element.textContent;
    const nextValue = (rawValue || "").replace(/\u00a0/g, " ").trim();
    element.textContent = nextValue;
    onCommit(nextValue);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (elementRef.current) elementRef.current.textContent = value;
      event.currentTarget.blur();
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (multiline && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <Tag
      aria-label={label}
      className={className}
      contentEditable
      data-inline-edit=""
      data-placeholder={placeholder}
      onBlur={finishEdit}
      onFocus={() => {
        isEditing.current = true;
      }}
      onKeyDown={handleKeyDown}
      ref={elementRef}
      spellCheck
      suppressContentEditableWarning
      tabIndex={0}
      title="Click to edit"
    >
      {value}
    </Tag>
  );
}

export default function Home() {
  const [data, setData] = useState<ResumeData>(initialData);
  const [style, setStyle] = useState<ResumeStyle>(initialStyle);
  const [activeTab, setActiveTab] = useState<"content" | "style" | "export">("content");
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "pdf">("pdf");
  const [exportScale, setExportScale] = useState(2);
  const [jpgQuality, setJpgQuality] = useState(0.9);
  const [exporting, setExporting] = useState(false);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const resumeRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("tian-resume-studio");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data) setData(parsed.data);
        if (parsed.style) setStyle(parsed.style);
      }
    } catch {
      // Keep the safe starter data if local storage is unavailable or invalid.
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem("tian-resume-studio", JSON.stringify({ data, style }));
  }, [data, style]);

  useEffect(() => {
    const updatePages = () => {
      if (!resumeRef.current) return;
      setPageCount(Math.max(1, Math.ceil(resumeRef.current.scrollHeight / 1056)));
    };
    updatePages();
    const observer = new ResizeObserver(updatePages);
    if (resumeRef.current) observer.observe(resumeRef.current);
    return () => observer.disconnect();
  }, [data, style]);

  const textLength = useMemo(() => JSON.stringify(data).length, [data]);
  const estimatedBytes = useMemo(() => {
    const pixels = 816 * 1056 * exportScale * exportScale * pageCount;
    const density = Math.min(1, textLength / 9000);
    const photoBytes = data.photo ? Math.floor((data.photo.length * 3) / 4) : 0;
    if (exportFormat === "png") return pixels * (0.1 + density * 0.09) + photoBytes * 0.7;
    if (exportFormat === "jpg") return pixels * (0.045 + density * 0.05) * jpgQuality + photoBytes * 0.45;
    return 70000 + textLength * 9 + pageCount * 38000 + photoBytes * 0.25;
  }, [data.photo, exportFormat, exportScale, jpgQuality, pageCount, textLength]);

  const updateContact = (key: keyof Omit<ResumeData, "sections">, value: string | boolean) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const updateSection = (sectionId: string, patch: Partial<ResumeSection>) => {
    setData((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
    }));
  };

  const updateEntry = (sectionId: string, entryId: string, patch: Partial<ResumeEntry>) => {
    setData((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? { ...section, entries: section.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)) }
          : section,
      ),
    }));
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setData((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });
  };

  const dropSection = (targetId: string) => {
    const sourceId = draggedSection;
    setDraggedSection(null);
    if (!sourceId || sourceId === targetId) return;
    setData((current) => {
      const from = current.sections.findIndex((section) => section.id === sourceId);
      const to = current.sections.findIndex((section) => section.id === targetId);
      if (from < 0 || to < 0) return current;
      const sections = [...current.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...current, sections };
    });
  };

  const addSection = (kind: SectionKind) => {
    const template = sectionTemplates[kind];
    const section: ResumeSection = {
      id: makeId(),
      kind,
      title: template.title,
      entries: [{ ...template.entry, id: makeId(), bullets: [...template.entry.bullets] }],
    };
    setData((current) => ({ ...current, sections: [...current.sections, section] }));
  };

  const addEntry = (section: ResumeSection) => {
    const template = sectionTemplates[section.kind].entry;
    updateSection(section.id, {
      entries: [...section.entries, { ...template, id: makeId(), bullets: [...template.bullets] }],
    });
  };

  const removeEntry = (section: ResumeSection, entryId: string) => {
    updateSection(section.id, { entries: section.entries.filter((entry) => entry.id !== entryId) });
  };

  const updateBullet = (sectionId: string, entry: ResumeEntry, bulletIndex: number, value: string) => {
    const bullets = [...entry.bullets];
    bullets[bulletIndex] = value;
    updateEntry(sectionId, entry.id, { bullets });
  };

  const removeSection = (sectionId: string) => {
    setData((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== sectionId) }));
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 600;
        const ratio = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        updateContact("photo", canvas.toDataURL("image/jpeg", 0.84));
        setStyle((current) => ({ ...current, showPhoto: true }));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = async (format: "png" | "jpg") => {
    if (!resumeRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(resumeRef.current, {
        scale: exportScale,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const extension = format === "png" ? "png" : "jpg";
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${safeFilename(data.name)}.${extension}`;
          link.click();
          URL.revokeObjectURL(link.href);
        },
        mime,
        format === "jpg" ? jpgQuality : undefined,
      );
    } finally {
      setExporting(false);
    }
  };

  const exportResume = async () => {
    if (exportFormat === "pdf") {
      window.print();
      return;
    }
    await downloadImage(exportFormat);
  };

  const resetResume = () => {
    if (!window.confirm("Reset every field and section to the original starter resume?")) return;
    setData(initialData);
    setStyle(initialStyle);
  };

  return (
    <main className="studio-shell">
      <header className="app-header no-print">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">TX</div>
          <div>
            <p className="eyebrow">Personal workspace</p>
            <h1>Resume Studio</h1>
          </div>
        </div>
        <div className="save-state">
          <span className="save-dot" aria-hidden="true" />
          Saved on this device
        </div>
      </header>

      <div className="workspace">
        <aside className="editor-panel no-print">
          <nav className="tab-list" aria-label="Resume editor">
            {(["content", "style", "export"] as const).map((tab) => (
              <button
                className={activeTab === tab ? "tab active" : "tab"}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="editor-scroll">
            {activeTab === "content" && (
              <>
                <section className="panel-block">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Header</p>
                      <h2>Personal details</h2>
                    </div>
                  </div>
                  <div className="field-grid two">
                    <label className="field">
                      <span>Name</span>
                      <input value={data.name} onChange={(event) => updateContact("name", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Headline</span>
                      <input value={data.headline} onChange={(event) => updateContact("headline", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input value={data.email} onChange={(event) => updateContact("email", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Phone</span>
                      <input value={data.phone} onChange={(event) => updateContact("phone", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Location</span>
                      <input placeholder="City, State" value={data.location} onChange={(event) => updateContact("location", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Portfolio</span>
                      <input value={data.portfolio} onChange={(event) => updateContact("portfolio", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Additional link</span>
                      <input value={data.secondaryLink} onChange={(event) => updateContact("secondaryLink", event.target.value)} />
                    </label>
                    <label className="field upload-field">
                      <span>Optional photo</span>
                      <input accept="image/png,image/jpeg" onChange={handlePhoto} type="file" />
                    </label>
                  </div>
                </section>

                <section className="panel-block">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Structure</p>
                      <h2>Resume sections</h2>
                    </div>
                    <span className="helper">Drag or use arrows</span>
                  </div>

                  <div className="section-stack">
                    {data.sections.map((section, sectionIndex) => (
                      <article
                        className={draggedSection === section.id ? "section-card dragging" : "section-card"}
                        key={section.id}
                        onDragOver={(event: DragEvent) => event.preventDefault()}
                        onDrop={() => dropSection(section.id)}
                      >
                        <div className="section-card-head">
                          <span
                            aria-label={`Drag ${section.title} to reorder`}
                            className="drag-handle"
                            draggable
                            onDragEnd={() => setDraggedSection(null)}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              setDraggedSection(section.id);
                            }}
                            role="button"
                            title="Drag to reorder"
                          >
                            ⋮⋮
                          </span>
                          <input
                            aria-label="Section title"
                            className="section-title-input"
                            value={section.title}
                            onChange={(event) => updateSection(section.id, { title: event.target.value })}
                          />
                          <div className="section-actions">
                            <button disabled={sectionIndex === 0} onClick={() => moveSection(section.id, -1)} title="Move up" type="button">↑</button>
                            <button disabled={sectionIndex === data.sections.length - 1} onClick={() => moveSection(section.id, 1)} title="Move down" type="button">↓</button>
                            <button className="danger-action" onClick={() => removeSection(section.id)} title="Remove section" type="button">×</button>
                          </div>
                        </div>

                        <div className="entry-stack">
                          {section.entries.map((entry, entryIndex) => (
                            <div className="entry-editor" key={entry.id}>
                              {section.kind !== "summary" && (
                                <div className="entry-editor-head">
                                  <span>Item {entryIndex + 1}</span>
                                  <button onClick={() => removeEntry(section, entry.id)} type="button">Remove</button>
                                </div>
                              )}

                              {section.kind !== "summary" && (
                                <div className="field-grid two">
                                  <label className="field">
                                    <span>{section.kind === "education" ? "School" : section.kind === "skills" ? "Category" : "Title"}</span>
                                    <input value={entry.heading} onChange={(event) => updateEntry(section.id, entry.id, { heading: event.target.value })} />
                                  </label>
                                  {section.kind !== "skills" && section.kind !== "awards" && (
                                    <label className="field">
                                      <span>{section.kind === "education" ? "Degree" : "Organization / role"}</span>
                                      <input value={entry.subheading} onChange={(event) => updateEntry(section.id, entry.id, { subheading: event.target.value })} />
                                    </label>
                                  )}
                                  {section.kind !== "skills" && (
                                    <label className="field">
                                      <span>Date</span>
                                      <input value={entry.date} onChange={(event) => updateEntry(section.id, entry.id, { date: event.target.value })} />
                                    </label>
                                  )}
                                  {section.kind === "projects" && (
                                    <label className="field">
                                      <span>Link</span>
                                      <input value={entry.link || ""} onChange={(event) => updateEntry(section.id, entry.id, { link: event.target.value })} />
                                    </label>
                                  )}
                                </div>
                              )}

                              <label className="field">
                                <span>{section.kind === "summary" ? "Summary" : section.kind === "skills" ? "Skills" : "Details"}</span>
                                <textarea
                                  rows={section.kind === "summary" ? 5 : 2}
                                  value={entry.details}
                                  onChange={(event) => updateEntry(section.id, entry.id, { details: event.target.value })}
                                />
                              </label>

                              {(section.kind === "experience" || section.kind === "projects" || section.kind === "custom") && (
                                <label className="field">
                                  <span>Bullets <small>one per line</small></span>
                                  <textarea
                                    rows={3}
                                    value={entry.bullets.join("\n")}
                                    onChange={(event) => updateEntry(section.id, entry.id, { bullets: event.target.value.split("\n") })}
                                  />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>

                        {section.kind !== "summary" && (
                          <button className="text-button" onClick={() => addEntry(section)} type="button">+ Add item</button>
                        )}
                      </article>
                    ))}
                  </div>

                  <div className="add-section-row">
                    <label className="field">
                      <span>Add another section</span>
                      <select defaultValue="" onChange={(event) => {
                        if (event.target.value) addSection(event.target.value as SectionKind);
                        event.target.value = "";
                      }}>
                        <option disabled value="">Choose a section…</option>
                        <option value="experience">Experience</option>
                        <option value="projects">Projects</option>
                        <option value="education">Education</option>
                        <option value="skills">Skills</option>
                        <option value="awards">Awards</option>
                        <option value="custom">Custom section</option>
                      </select>
                    </label>
                  </div>
                </section>
              </>
            )}

            {activeTab === "style" && (
              <section className="panel-block style-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Presentation</p>
                    <h2>Make it yours</h2>
                  </div>
                </div>

                <fieldset className="choice-group">
                  <legend>Typeface</legend>
                  <div className="choice-grid">
                    {([
                      ["modern", "Modern", "Clear and ATS-friendly"],
                      ["classic", "Classic", "Editorial and traditional"],
                      ["humanist", "Humanist", "Warm and approachable"],
                    ] as const).map(([value, label, note]) => (
                      <label className={style.font === value ? "choice-card selected" : "choice-card"} key={value}>
                        <input
                          checked={style.font === value}
                          name="font"
                          onChange={() => setStyle((current) => ({ ...current, font: value }))}
                          type="radio"
                        />
                        <strong>{label}</strong>
                        <span>{note}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="choice-group">
                  <legend>Spacing</legend>
                  <div className="segmented">
                    {(["comfortable", "compact"] as const).map((value) => (
                      <button
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

                <label className="field color-field">
                  <span>Accent color</span>
                  <div>
                    <input
                      aria-label="Accent color"
                      type="color"
                      value={style.accent}
                      onChange={(event) => setStyle((current) => ({ ...current, accent: event.target.value }))}
                    />
                    <input
                      value={style.accent}
                      onChange={(event) => setStyle((current) => ({ ...current, accent: event.target.value }))}
                    />
                  </div>
                </label>

                <label className="toggle-row">
                  <span>
                    <strong>Show photo</strong>
                    <small>{data.photo ? "Include your uploaded photo" : "Upload a photo in Content first"}</small>
                  </span>
                  <input
                    checked={style.showPhoto}
                    disabled={!data.photo}
                    onChange={(event) => setStyle((current) => ({ ...current, showPhoto: event.target.checked }))}
                    type="checkbox"
                  />
                </label>

                <button className="secondary-button" onClick={resetResume} type="button">Reset starter content</button>
              </section>
            )}

            {activeTab === "export" && (
              <section className="panel-block export-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Output</p>
                    <h2>Download your resume</h2>
                  </div>
                </div>

                <div className="format-grid" role="radiogroup" aria-label="Export format">
                  {([
                    ["pdf", "PDF", "Best for applications"],
                    ["png", "PNG", "Sharp image"],
                    ["jpg", "JPG", "Smaller image"],
                  ] as const).map(([value, label, note]) => (
                    <button
                      aria-checked={exportFormat === value}
                      className={exportFormat === value ? "format-card selected" : "format-card"}
                      key={value}
                      onClick={() => setExportFormat(value)}
                      role="radio"
                      type="button"
                    >
                      <strong>{label}</strong>
                      <span>{note}</span>
                    </button>
                  ))}
                </div>

                {exportFormat !== "pdf" && (
                  <label className="field range-field">
                    <span>Image resolution <strong>{exportScale}×</strong></span>
                    <input
                      max="3"
                      min="1"
                      onChange={(event) => setExportScale(Number(event.target.value))}
                      step="1"
                      type="range"
                      value={exportScale}
                    />
                  </label>
                )}

                {exportFormat === "jpg" && (
                  <label className="field range-field">
                    <span>JPG quality <strong>{Math.round(jpgQuality * 100)}%</strong></span>
                    <input
                      max="0.98"
                      min="0.55"
                      onChange={(event) => setJpgQuality(Number(event.target.value))}
                      step="0.01"
                      type="range"
                      value={jpgQuality}
                    />
                  </label>
                )}

                <div className="estimate-card">
                  <div>
                    <span>Approximate file size</span>
                    <strong>≈ {formatBytes(estimatedBytes)}</strong>
                  </div>
                  <div>
                    <span>Document length</span>
                    <strong>{pageCount} {pageCount === 1 ? "page" : "pages"}</strong>
                  </div>
                </div>

                {exportFormat === "pdf" && (
                  <p className="export-note">
                    PDF opens the print dialog. Choose “Save as PDF” for selectable text and better applicant-system compatibility.
                  </p>
                )}

                <button className="primary-button" disabled={exporting} onClick={exportResume} type="button">
                  {exporting ? "Preparing file…" : exportFormat === "pdf" ? "Open PDF export" : `Download ${exportFormat.toUpperCase()}`}
                </button>
                <p className="fine-print">The estimate changes with format, resolution, content, and photos. Final size may vary.</p>
              </section>
            )}
          </div>
        </aside>

        <section className="preview-stage">
          <div className="preview-toolbar no-print">
            <div>
              <span className="status-pill">Click text to edit</span>
              <span>{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
            </div>
            <button onClick={() => setActiveTab("export")} type="button">Export</button>
          </div>

          <div className="paper-wrap">
            <div
              className={`resume-paper font-${style.font} density-${style.density}`}
              ref={resumeRef}
              style={{ "--resume-accent": style.accent } as React.CSSProperties}
            >
              <header className={style.showPhoto && data.photo ? "resume-header with-photo" : "resume-header"}>
                <div>
                  <InlineEdit
                    as="h2"
                    label="Name"
                    onCommit={(value) => updateContact("name", value)}
                    placeholder="Your Name"
                    value={data.name}
                  />
                  <InlineEdit
                    as="p"
                    className="resume-headline"
                    label="Professional headline"
                    onCommit={(value) => updateContact("headline", value)}
                    placeholder="Professional headline"
                    value={data.headline}
                  />
                  <div className="contact-line">
                    {([
                      ["email", data.email],
                      ["phone", data.phone],
                      ["location", data.location],
                      ["portfolio", data.portfolio],
                      ["secondaryLink", data.secondaryLink],
                    ] as const)
                      .filter(Boolean)
                      .filter(([, item]) => Boolean(item))
                      .map(([key, item]) => (
                        <InlineEdit
                          as="span"
                          key={key}
                          label={key === "secondaryLink" ? "Additional link" : key}
                          onCommit={(value) => updateContact(key, value)}
                          value={item}
                        />
                      ))}
                  </div>
                </div>
                {style.showPhoto && data.photo && <img alt={`${data.name} portrait`} src={data.photo} />}
              </header>

              <div className="resume-body">
                {data.sections.map((section) => (
                  <section className={`resume-section kind-${section.kind}`} key={section.id}>
                    <InlineEdit
                      as="h3"
                      label={`${section.title} section title`}
                      onCommit={(value) => updateSection(section.id, { title: value })}
                      placeholder="Section title"
                      value={section.title}
                    />

                    {section.kind === "summary" ? (
                      <InlineEdit
                        as="p"
                        className="summary-text"
                        label="Professional summary"
                        multiline
                        onCommit={(value) => {
                          const entry = section.entries[0];
                          if (entry) updateEntry(section.id, entry.id, { details: value });
                        }}
                        placeholder="Click to write a professional summary"
                        value={section.entries[0]?.details || ""}
                      />
                    ) : section.kind === "skills" ? (
                      <div className="skill-list">
                        {section.entries.map((entry) => (
                          <div className="skill-row" key={entry.id}>
                            <InlineEdit
                              as="strong"
                              label="Skill category"
                              onCommit={(value) => updateEntry(section.id, entry.id, { heading: value })}
                              placeholder="Category"
                              value={entry.heading}
                            />
                            <InlineEdit
                              as="span"
                              label={`${entry.heading || "Skill"} details`}
                              onCommit={(value) => updateEntry(section.id, entry.id, { details: value })}
                              placeholder="Skills"
                              value={entry.details}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="resume-entry-list">
                        {section.entries.map((entry) => (
                          <article className="resume-entry" key={entry.id}>
                            <div className="resume-entry-heading">
                              <div>
                                <InlineEdit
                                  as="h4"
                                  label={`${section.title} item title`}
                                  onCommit={(value) => updateEntry(section.id, entry.id, { heading: value })}
                                  placeholder="Item title"
                                  value={entry.heading}
                                />
                                {entry.subheading && (
                                  <InlineEdit
                                    as="p"
                                    label={`${entry.heading} supporting information`}
                                    onCommit={(value) => updateEntry(section.id, entry.id, { subheading: value })}
                                    value={entry.subheading}
                                  />
                                )}
                              </div>
                              {entry.date && (
                                <InlineEdit
                                  as="time"
                                  label={`${entry.heading} date`}
                                  onCommit={(value) => updateEntry(section.id, entry.id, { date: value })}
                                  value={entry.date}
                                />
                              )}
                            </div>
                            {entry.link && (
                              <InlineEdit
                                as="p"
                                className="entry-link"
                                label={`${entry.heading} link`}
                                onCommit={(value) => updateEntry(section.id, entry.id, { link: value })}
                                value={entry.link}
                              />
                            )}
                            {entry.details && (
                              <InlineEdit
                                as="p"
                                className="entry-details"
                                label={`${entry.heading} details`}
                                multiline
                                onCommit={(value) => updateEntry(section.id, entry.id, { details: value })}
                                value={entry.details}
                              />
                            )}
                            {entry.bullets.some((bullet) => bullet.trim()) && (
                              <ul>
                                {entry.bullets.map((bullet, index) =>
                                  bullet.trim() ? (
                                    <InlineEdit
                                      as="li"
                                      key={index}
                                      label={`${entry.heading} bullet ${index + 1}`}
                                      multiline
                                      onCommit={(value) => updateBullet(section.id, entry, index, value)}
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
