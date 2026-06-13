import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeData } from "../builder";

// Modern two-column resume template with sidebar

const styles = StyleSheet.create({
  // TODO: Define styles for modern template
  page: { padding: 0, fontFamily: "Helvetica", flexDirection: "row" },
  sidebar: { width: "30%", backgroundColor: "#18181b", padding: 20 },
  main: { flex: 1, padding: 30 },
});

export function ModernTemplate({ data, isPro }: { data: ResumeData; isPro: boolean }) {
  void isPro; // reserved for future watermark/pro feature parity with ClassicTemplate
  // TODO: Implement modern two-column resume template with @react-pdf/renderer
  return (
    <Document>
      <Page style={styles.page}>
        <View style={styles.sidebar}>
          <Text style={{ color: "white" }}>{data.fullName}</Text>
        </View>
        <View style={styles.main} />
      </Page>
    </Document>
  );
}
