import type { ResumeData } from "../resume-model";

/**
 * The example resume shown when Quicky Resume is first opened.
 *
 * Replace this object with another ResumeData object to ship a different
 * starter case. Once the app has opened, edits are saved locally in the
 * browser and do not modify this source file.
 */
export const tianXingExample: ResumeData = {
  name: "Tian Xing",
  headline: "Educational Technologist | Learning Experience Designer",
  email: "tx845@nyu.edu",
  phone: "(551) 414-5977",
  location: "",
  portfolio: "xingpicture.myportfolio.com",
  secondaryLink: "ins: xing_tian_lifeitself",
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
            "Educational technologist and learning experience designer with expertise in educational game design, AI-enabled workflows, multimedia production, and music education. Experienced in LMS administration, instructional support, automation, and the design of interactive learning tools.",
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
          date: "2024-2026",
          details: "",
          bullets: [],
        },
        {
          id: "education-2",
          heading: "Berklee College of Music",
          subheading: "Bachelor of Music, Jazz Composition",
          date: "2021-2024",
          details: "Scholarship recipient",
          bullets: [],
        },
        {
          id: "education-3",
          heading: "City University of New York",
          subheading: "Associate in Science, Music Studies",
          date: "2018-2020",
          details: "CUNY Jazz Ensemble Pianist",
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
          date: "2026/02-2026/05",
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
          date: "2021/03-2024/05",
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
          details: "A website turn a syllabus into a full teachable course.",
          bullets: [],
        },
        {
          id: "project-2",
          heading: "Surge Method",
          subheading: "iOS App Designer & Developer",
          date: "",
          details: "An app focused on an original learning method, it works on anything that needs repetition.",
          bullets: [],
        },
        {
          id: "project-3",
          heading: "BebopPuzzle.com",
          subheading: "Web Game Designer & Developer",
          date: "",
          details: "A jazz ear training puzzle game.",
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
          details: "Instructional support, LMS administration, AI implementation, workflow automation",
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
          heading: "IPA International Photography Award 3rd place",
          subheading: "",
          date: "2017",
          details: "People & Event Category",
          bullets: [],
        },
      ],
    },
  ],
};
