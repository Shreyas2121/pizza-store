import { Button, Group } from "@mantine/core";
import { Download } from "lucide-react";
import { error, success } from "@/shared/lib/notifications";
import { useDownloadFinanceExport, type FinanceExportType } from "../api/finance.queries";
import { apiMessage } from "../model/finance.helpers";
import type { FinanceReportGroup } from "../model/finance.types";

const labels: Record<FinanceExportType, string> = {
  overview: "Export overview CSV",
  "profit-and-loss": "Export P&L CSV",
  sales: "Export sales CSV",
  margins: "Export margins CSV",
};

export const FinanceExportButtons = ({ reportTypes, storeId, from, to, groupBy }: {
  reportTypes: FinanceExportType[];
  storeId: number | null;
  from: string;
  to: string;
  groupBy: FinanceReportGroup;
}) => {
  const download = useDownloadFinanceExport();
  return <Group gap="xs">
    {reportTypes.map((reportType) => <Button
      key={reportType}
      variant="light"
      leftSection={<Download size={16} />}
      loading={download.isPending && download.variables?.reportType === reportType}
      disabled={from > to}
      onClick={async () => {
        try {
          const filename = await download.mutateAsync({ reportType, storeId, from, to, groupBy });
          success(`${filename} downloaded.`);
        } catch (cause) {
          error(apiMessage(cause));
        }
      }}
    >{labels[reportType]}</Button>)}
  </Group>;
};
