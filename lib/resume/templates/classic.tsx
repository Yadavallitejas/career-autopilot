import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeData } from "../builder";

// Classic single-column ATS-friendly resume template

const styles = StyleSheet.create({
  // TODO: Define styles for classic template
  page: { padding: 40, fontFamily: "Helvetica" },
});

export function ClassicTemplate({ data }: { data: ResumeData }) {
  // TODO: Implement classic resume template with @react-pdf/renderer
  return (
    <Document>
      <Page style={styles.page}>
        <Text>{data.fullName}</Text>
      </Page>
    </Document>
  );
}
