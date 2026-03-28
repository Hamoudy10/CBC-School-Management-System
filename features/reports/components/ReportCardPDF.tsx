// features/reports/components/ReportCardPDF.tsx
import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CBCReportCardData } from "@/features/reports/types";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#1d4ed8",
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1d4ed8",
  },
  subtitle: {
    marginTop: 4,
    color: "#4b5563",
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#1d4ed8",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  infoLabel: {
    width: "35%",
    color: "#6b7280",
  },
  infoValue: {
    width: "63%",
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  statValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 700,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  colWide: {
    flex: 2.4,
  },
  colMid: {
    flex: 1.2,
  },
  colNarrow: {
    flex: 0.9,
    textAlign: "right",
  },
  remarksBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  remarksLabel: {
    fontWeight: 700,
    marginBottom: 4,
  },
});

function toLabel(level: string) {
  switch (level) {
    case "EE":
      return "Exceeding Expectation";
    case "ME":
      return "Meeting Expectation";
    case "AE":
      return "Approaching Expectation";
    case "BE":
    default:
      return "Below Expectation";
  }
}

export function ReportCardDocument({ data }: { data: CBCReportCardData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{data.school.name}</Text>
          <Text style={styles.subtitle}>
            CBC Progress Report - {data.student.term} {data.student.academic_year}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Summary</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Student</Text>
            <Text style={styles.infoValue}>{data.student.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Admission No.</Text>
            <Text style={styles.infoValue}>{data.student.admission_no}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Class</Text>
            <Text style={styles.infoValue}>{data.student.class_name}</Text>
          </View>
        </View>

        <View style={[styles.section, styles.statsRow]}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Overall Score</Text>
            <Text style={styles.statValue}>
              {data.overall.average_score.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Performance</Text>
            <Text style={styles.statValue}>{data.overall.level}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Attendance Rate</Text>
            <Text style={styles.statValue}>{data.attendance.attendance_rate}%</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learning Areas</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colWide}>Learning Area</Text>
            <Text style={styles.colMid}>Descriptor</Text>
            <Text style={styles.colNarrow}>Score</Text>
          </View>
          {data.learning_areas.length > 0 ? (
            data.learning_areas.map((learningArea) => (
              <View key={learningArea.name} style={styles.tableRow}>
                <Text style={styles.colWide}>{learningArea.name}</Text>
                <Text style={styles.colMid}>
                  {learningArea.level_label || toLabel(learningArea.level)}
                </Text>
                <Text style={styles.colNarrow}>
                  {learningArea.average_score.toFixed(2)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={styles.colWide}>No learning-area analytics recorded.</Text>
              <Text style={styles.colMid} />
              <Text style={styles.colNarrow}>-</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remarks</Text>
          <View style={styles.remarksBox}>
            <Text style={styles.remarksLabel}>Class Teacher</Text>
            <Text>{data.remarks.class_teacher || "No remarks provided."}</Text>
          </View>
          <View style={styles.remarksBox}>
            <Text style={styles.remarksLabel}>Principal</Text>
            <Text>{data.remarks.principal || "No remarks provided."}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default ReportCardDocument;
