import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ResumeData } from "../builder";

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const C = {
  black: "#111111",
  darkGray: "#374151",
  medGray: "#6b7280",
  lightGray: "#e5e7eb",
  accent: "#1d4ed8",   // dark blue — ATS-safe, not neon
  watermark: "#94a3b8",
};

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  // Page
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.black,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },

  // Header
  header: {
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contactItem: {
    fontSize: 9,
    color: C.darkGray,
  },
  contactSep: {
    fontSize: 9,
    color: C.medGray,
  },

  // Section
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    textTransform: "uppercase",
    letterSpacing: 1,
    borderBottom: `1pt solid ${C.lightGray}`,
    paddingBottom: 3,
    marginBottom: 6,
  },

  // Summary
  summaryText: {
    fontSize: 10,
    color: C.darkGray,
    lineHeight: 1.5,
  },

  // Experience / Project row
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  entryTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.black,
  },
  entrySubtitle: {
    fontSize: 9.5,
    color: C.darkGray,
    marginBottom: 3,
  },
  entryDate: {
    fontSize: 9,
    color: C.medGray,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 2,
  },
  bulletDot: {
    fontSize: 10,
    color: C.medGray,
    width: 10,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 9.5,
    color: C.darkGray,
    flex: 1,
    lineHeight: 1.4,
  },
  entryBlock: {
    marginBottom: 8,
  },

  // Education
  eduHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eduDegree: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.black,
  },
  eduSchool: {
    fontSize: 9.5,
    color: C.darkGray,
  },
  eduMeta: {
    fontSize: 9,
    color: C.medGray,
    textAlign: "right",
  },

  // Certifications
  certRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  certName: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    flex: 1,
  },
  certMeta: {
    fontSize: 9,
    color: C.medGray,
    textAlign: "right",
  },
  certIssuer: {
    fontSize: 9,
    color: C.darkGray,
  },

  // Skills
  skillsText: {
    fontSize: 9.5,
    color: C.darkGray,
    lineHeight: 1.5,
  },

  // Footer / watermark
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    textAlign: "center",
  },
  footerText: {
    fontSize: 7.5,
    color: C.watermark,
  },
});

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function ContactSeparator() {
  return <Text style={s.contactSep}>  ·  </Text>;
}

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ClassicTemplate
// ---------------------------------------------------------------------------

export function ClassicTemplate({
  data,
  isPro,
}: {
  data: ResumeData;
  isPro: boolean;
}) {
  // Build contact row items — only render items that exist
  const contactItems = [
    data.email,
    data.phone,
    data.location,
    data.linkedinUrl,
    data.githubUrl,
  ].filter(Boolean) as string[];

  return (
    <Document
      title={`${data.fullName} — Resume`}
      author={data.fullName}
      creator="Career Autopilot"
      producer="Career Autopilot"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.name}>{data.fullName}</Text>
          <View style={s.contactRow}>
            {contactItems.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ContactSeparator />}
                <Text style={s.contactItem}>{item}</Text>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Summary ─────────────────────────────────────────── */}
        {data.summary && (
          <>
            <SectionHeading title="Summary" />
            <Text style={s.summaryText}>{data.summary}</Text>
          </>
        )}

        {/* ── Experience ──────────────────────────────────────── */}
        {data.experience.length > 0 && (
          <>
            <SectionHeading title="Experience" />
            {data.experience.map((exp, idx) => (
              <View key={idx} style={s.entryBlock} wrap={false}>
                <View style={s.entryHeader}>
                  <Text style={s.entryTitle}>{exp.title}</Text>
                  <Text style={s.entryDate}>
                    {exp.startDate}
                    {exp.endDate ? ` – ${exp.endDate}` : " – Present"}
                  </Text>
                </View>
                <Text style={s.entrySubtitle}>{exp.company}</Text>
                {exp.bullets.map((bullet, bIdx) => (
                  <View key={bIdx} style={s.bullet}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ── Education ───────────────────────────────────────── */}
        {data.education.length > 0 && (
          <>
            <SectionHeading title="Education" />
            {data.education.map((edu, idx) => {
              // Support both field shapes: graduationYear (new) and graduationDate (legacy)
              const gradYear =
                (edu as { graduationYear?: string }).graduationYear ??
                (edu as { graduationDate?: string }).graduationDate ??
                "";
              const gpa = (edu as { gpa?: string }).gpa;
              const field = (edu as { field?: string }).field;

              return (
                <View key={idx} style={s.entryBlock} wrap={false}>
                  <View style={s.eduHeader}>
                    <View>
                      <Text style={s.eduDegree}>
                        {edu.degree}
                        {field ? ` — ${field}` : ""}
                      </Text>
                      <Text style={s.eduSchool}>{edu.institution}</Text>
                    </View>
                    <View>
                      <Text style={s.eduMeta}>{gradYear}</Text>
                      {gpa && (
                        <Text style={s.eduMeta}>GPA: {gpa}</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Certifications ──────────────────────────────────── */}
        {data.certifications.length > 0 && (
          <>
            <SectionHeading title="Certifications" />
            {data.certifications.map((cert, idx) => (
              <View key={idx} style={s.entryBlock} wrap={false}>
                <View style={s.certRow}>
                  <Text style={s.certName}>{cert.name}</Text>
                  <Text style={s.certMeta}>
                    {cert.date ?? ""}
                  </Text>
                </View>
                <Text style={s.certIssuer}>{cert.issuer}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Projects ────────────────────────────────────────── */}
        {data.projects.length > 0 && (
          <>
            <SectionHeading title="Projects" />
            {data.projects.map((proj, idx) => {
              // Support both tech[] (new) and technologies[] (legacy)
              const tech =
                (proj as { tech?: string[] }).tech ??
                (proj as { technologies?: string[] }).technologies ??
                [];

              return (
                <View key={idx} style={s.entryBlock} wrap={false}>
                  <View style={s.entryHeader}>
                    <Text style={s.entryTitle}>
                      {proj.name}
                      {proj.url ? `  ↗ ${proj.url}` : ""}
                    </Text>
                  </View>
                  <Text style={s.bulletText}>{proj.description}</Text>
                  {tech.length > 0 && (
                    <Text style={[s.bulletText, { color: C.medGray, marginTop: 2 }]}>
                      Tech: {tech.join(", ")}
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── Skills ──────────────────────────────────────────── */}
        {data.skills.length > 0 && (
          <>
            <SectionHeading title="Skills" />
            <Text style={s.skillsText}>{data.skills.join("  ·  ")}</Text>
          </>
        )}

        {/* ── Footer (free tier watermark) ────────────────────── */}
        {!isPro && (
          <View style={s.footer} fixed>
            <Text style={s.footerText}>Made with Career Autopilot</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
