import DashboardCard from "@/components/admin/dashboard/card";
import DatePicker from "@/components/admin/dashboard/date-picker";
import {
  useGetDashboardCardsData,
  useGetDashboardChartsData,
} from "@/hooks/dashboard";
import { useDatePicker } from "@/store/datepicker";
import { useAuthModalStore } from "@/store/modal";
import { Button, Card } from "@mantine/core";
import { format } from "date-fns";
import { useMemo } from "react";
import { BarChart, LineChart } from "@mantine/charts";
import { formatPrice } from "@/lib/utils";

const AdminHome = () => {
  const { dates, group } = useDatePicker();
  const { openModal } = useAuthModalStore();

  const [from, to] = dates;

  const { data, isLoading } = useGetDashboardCardsData(from, to);

  const { data: chartsData, isLoading: loadingCharts } =
    useGetDashboardChartsData(from, to, group);

  const formattedDates = useMemo(() => {
    return from && to
      ? `${format(from, "MMM dd, yyyy")} - ${format(to, "MMM dd, yyyy")}`
      : "Select Date Range";
  }, [dates]);

  if (isLoading || loadingCharts) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <Button
          variant="gradient"
          gradient={{ from: "myColor.4", to: "myColor.8", deg: 35 }}
          onClick={() =>
            openModal({
              content: <DatePicker />,
              title: "",
            })
          }
        >
          {formattedDates}
        </Button>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {data!.map((card, index: number) => (
          <DashboardCard key={index} card={card} />
        ))}
      </div>

      <div className="flex gap-2 pt-4 pb-4">
        <div className="bg-white p-4 rounded shadow hover:shadow-lg transition flex-1">
          <h2 className="text-lg font-semibold mb-2">Revenue Over Time</h2>
          <LineChart
            h={300}
            data={chartsData!.revenueOverTime}
            dataKey="period"
            curveType="linear"
            valueFormatter={(value) => formatPrice(value)}
            series={[
              {
                name: "revenue",
                label: "Revenue",
              },
            ]}
          />
        </div>
        <div className="flex-1">
          <div className="bg-white p-4 rounded shadow hover:shadow-lg transition flex-1">
            <h2 className="text-lg font-semibold mb-2">Orders Over Time</h2>
            <BarChart
              h={300}
              data={chartsData!.ordersOverTime}
              maxBarWidth={20}
              dataKey="period"
              series={[
                {
                  name: "orders",
                  label: "Orders",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
