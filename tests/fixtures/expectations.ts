/**
 * What a good import should recover from each fixture in `resumes/`.
 *
 * `sections` lists the section kinds that must be present. `entryHeadings` and
 * `bullets` are substring probes — the importer is heuristic, so these assert
 * that the right content landed in the right shape, not exact formatting.
 */
export type Expectation = {
  file: string;
  label: string;
  /** What makes this document hard. */
  challenge: string;
  name: string;
  headline?: string;
  email: string;
  phone?: string;
  location?: string;
  link?: string;
  sections: string[];
  entryHeadings: string[];
  bullets: string[];
  /** Text that must NOT appear anywhere — page furniture, duplicated headers. */
  absent?: string[];
};

export const expectations: Expectation[] = [
  {
    file: "classic.html",
    label: "classic single column",
    challenge: "right-aligned dates on the same visual line as the title",
    name: "Priya Raghunathan",
    headline: "Senior Data Engineer",
    email: "priya.r@example.com",
    phone: "(206) 555-0184",
    location: "Seattle, WA",
    link: "linkedin.com/in/priyar",
    sections: ["summary", "experience", "education", "skills"],
    entryHeadings: ["Principal Data Engineer", "Data Engineer", "University of Washington"],
    bullets: ["18 minutes", "contract testing", "850k events"],
  },
  {
    file: "two-column.html",
    label: "two column with sidebar",
    challenge: "a left sidebar interleaves with the main column by y position",
    name: "Marcus Oyelaran",
    headline: "Staff Platform Engineer",
    email: "marcus.oyelaran@example.com",
    phone: "(312) 555-7741",
    location: "Chicago, IL",
    link: "github.com/moyelaran",
    sections: ["experience", "skills", "education"],
    entryHeadings: ["Staff Engineer", "Senior Engineer"],
    bullets: ["22 to 6 minutes", "multi-region failover", "40k requests"],
  },
  {
    file: "allcaps-stacked.html",
    label: "all-caps headings, stacked employer",
    challenge: "headings are ALL CAPS and the employer sits on its own line",
    name: "ELENA KOVAČ",
    email: "elena.kovac@example.com",
    phone: "415-555-0993",
    location: "San Francisco, CA",
    sections: ["experience", "education", "skills"],
    entryHeadings: ["Senior Product Manager", "Product Manager", "Stanford University"],
    bullets: ["4.2M ARR", "60 customers", "14 releases"],
  },
  {
    file: "linkedin-style.html",
    label: "LinkedIn PDF export",
    challenge: "company precedes the title, and dates carry a duration suffix",
    name: "Daniel Okonkwo",
    email: "daniel.okonkwo@example.com",
    location: "Boston, Massachusetts",
    sections: ["experience", "education", "skills"],
    entryHeadings: ["Engineering Manager", "Senior Software Engineer"],
    bullets: [],
  },
  {
    file: "typography.html",
    challenge: "ligatures, hyphenated line breaks, curly quotes, unicode bullets",
    label: "typographic edge cases",
    name: "Sofia Ferrán-Whitfield",
    headline: "Clinical Research Coordinator",
    email: "sofia.ferran@example.com",
    phone: "(617) 555-0220",
    location: "Cambridge, MA",
    sections: ["experience", "education", "skills"],
    entryHeadings: ["Research Coordinator", "Tufts University"],
    // "classification" and "stratification" are split by a line-break hyphen
    // in the rendered PDF and must be rejoined.
    bullets: ["classification", "stratification", "standard operating procedures", "62%"],
  },
  {
    file: "multipage.html",
    label: "two pages with running header and footer",
    challenge: "repeated page furniture must not become resume content",
    name: "Aisha Bello",
    headline: "Research Scientist",
    email: "a.bello@example.edu",
    phone: "(734) 555-0117",
    location: "Ann Arbor, MI",
    sections: ["experience", "education", "awards", "skills"],
    entryHeadings: ["Research Scientist", "Postdoctoral Fellow", "University of Michigan"],
    bullets: ["240 principal investigators", "$1.8M", "seven first-author"],
    absent: ["Page 1 of 2", "Page 2 of 2", "Curriculum Vitae"],
  },
  {
    file: "plain.txt",
    label: "plain text",
    challenge: "column alignment is whitespace only",
    name: "KWAME ASANTE",
    headline: "Financial Analyst",
    email: "kwame.asante@example.com",
    phone: "646-555-0188",
    location: "New York, NY",
    sections: ["summary", "experience", "education", "skills"],
    entryHeadings: ["Senior Analyst", "Analyst", "New York University"],
    bullets: ["discounted cash flow", "40 research notes", "12 transactions"],
  },
];
