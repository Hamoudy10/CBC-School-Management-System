// features/reports/components/ReportCardPDF.tsx
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';

export function ReportCardDocument({ data }: { data: any }) {
  return (
    <Document>
      <Page>
        <View>
          <Text>Report Card</Text>
        </View>
      </Page>
    </Document>
  );
}

export default ReportCardDocument;
