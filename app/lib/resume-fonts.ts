export type ResumeFontId =
  | "calibri"
  | "arial"
  | "helvetica"
  | "aptos"
  | "cambria"
  | "garamond"
  | "georgia"
  | "times-new-roman"
  | "verdana"
  | "trebuchet"
  | "tahoma"
  | "segoe"
  | "palatino"
  | "avenir"
  | "gill-sans"
  | "book-antiqua"
  | "century-gothic"
  | "franklin-gothic"
  | "inter"
  | "lato"
  | "roboto"
  | "open-sans"
  | "source-sans"
  | "noto-sans"
  | "ibm-plex"
  | "fira-sans"
  | "merriweather"
  | "libre-baskerville"
  | "eb-garamond"
  | "geist";

export type ResumeFontOption = {
  id: ResumeFontId;
  label: string;
  note: string;
  stack: string;
};

export const resumeFonts: ResumeFontOption[] = [
  { id: "calibri", label: "Calibri", note: "Familiar ATS standard", stack: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif' },
  { id: "cambria", label: "Cambria", note: "Readable traditional serif", stack: 'Cambria, Georgia, "Times New Roman", serif' },
  { id: "helvetica", label: "Helvetica Neue", note: "Clean professional", stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: "georgia", label: "Georgia", note: "Strong screen readability", stack: 'Georgia, "Times New Roman", serif' },
  { id: "arial", label: "Arial", note: "Universal and neutral", stack: 'Arial, Helvetica, sans-serif' },
  { id: "garamond", label: "Garamond", note: "Elegant and space-efficient", stack: 'Garamond, "EB Garamond", Georgia, serif' },
  { id: "aptos", label: "Aptos", note: "Modern Office default", stack: 'Aptos, Calibri, "Segoe UI", Arial, sans-serif' },
  { id: "times-new-roman", label: "Times New Roman", note: "Conservative classic", stack: '"Times New Roman", Times, serif' },
  { id: "palatino", label: "Palatino", note: "Polished editorial serif", stack: '"Palatino Linotype", Palatino, Georgia, serif' },
  { id: "verdana", label: "Verdana", note: "Excellent small-size clarity", stack: 'Verdana, Geneva, sans-serif' },
  { id: "tahoma", label: "Tahoma", note: "Compact and highly legible", stack: 'Tahoma, Verdana, sans-serif' },
  { id: "trebuchet", label: "Trebuchet MS", note: "Warm and approachable", stack: '"Trebuchet MS", Arial, sans-serif' },
  { id: "segoe", label: "Segoe UI", note: "Contemporary business", stack: '"Segoe UI", Arial, sans-serif' },
  { id: "avenir", label: "Avenir Next", note: "Refined geometric sans", stack: '"Avenir Next", Avenir, Arial, sans-serif' },
  { id: "gill-sans", label: "Gill Sans", note: "Humanist and distinctive", stack: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif' },
  { id: "book-antiqua", label: "Book Antiqua", note: "Traditional and open", stack: '"Book Antiqua", Palatino, Georgia, serif' },
  { id: "century-gothic", label: "Century Gothic", note: "Geometric modern", stack: '"Century Gothic", Futura, Arial, sans-serif' },
  { id: "franklin-gothic", label: "Franklin Gothic", note: "Confident editorial sans", stack: '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif' },
  { id: "inter", label: "Inter", note: "Digital product clarity", stack: 'var(--font-resume-inter), Arial, sans-serif' },
  { id: "lato", label: "Lato", note: "Friendly professional", stack: 'var(--font-resume-lato), Arial, sans-serif' },
  { id: "roboto", label: "Roboto", note: "Balanced and familiar", stack: 'var(--font-resume-roboto), Arial, sans-serif' },
  { id: "open-sans", label: "Open Sans", note: "Open, neutral forms", stack: 'var(--font-resume-open-sans), Arial, sans-serif' },
  { id: "source-sans", label: "Source Sans 3", note: "Crisp editorial utility", stack: 'var(--font-resume-source-sans), Arial, sans-serif' },
  { id: "noto-sans", label: "Noto Sans", note: "Broad language support", stack: 'var(--font-resume-noto-sans), Arial, sans-serif' },
  { id: "ibm-plex", label: "IBM Plex Sans", note: "Technical and precise", stack: 'var(--font-resume-ibm-plex), Arial, sans-serif' },
  { id: "fira-sans", label: "Fira Sans", note: "Humanist technical", stack: 'var(--font-resume-fira-sans), Arial, sans-serif' },
  { id: "merriweather", label: "Merriweather", note: "Readable modern serif", stack: 'var(--font-resume-merriweather), Georgia, serif' },
  { id: "libre-baskerville", label: "Libre Baskerville", note: "Formal and literary", stack: 'var(--font-resume-libre-baskerville), Georgia, serif' },
  { id: "eb-garamond", label: "EB Garamond", note: "Classic book typography", stack: 'var(--font-resume-eb-garamond), Garamond, Georgia, serif' },
  { id: "geist", label: "Geist", note: "Minimal contemporary sans", stack: 'var(--font-geist-sans), Arial, sans-serif' },
];

export const getResumeFont = (id: ResumeFontId) =>
  resumeFonts.find((font) => font.id === id) ?? resumeFonts[0];
