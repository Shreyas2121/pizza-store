import { useEffect, useMemo } from "react";
import { BarChart, LineChart } from "@mantine/charts";
import { Button } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { ArrowRight, CalendarRange, ClipboardList } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { DashboardCard } from "../components/dashboard-card";
import { DatePicker } from "../components/date-picker";
import { useDatePicker } from "../model/dashboard-date.store";

import {
  useGetDashboardCardsData,
  useGetDashboardChartsData,
} from "../api/dashboard.queries";
import { useGetAdminOrders } from "@/features/orders";
import { OrderStatus } from "@/features/orders";

import { formatDate, formatDateTime, formatPrice } from "@/shared/lib";
import { useSocketStore } from "@/features/support";
import { useStaffActiveStore } from "@/features/access";

import { useAuthModalStore } from "@/shared/model";
import { CardGridSkeleton, ChartSkeleton, ListSkeleton, RefreshIndicator } from "@/shared/ui";

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { socket } = useSocketStore();
  const { dates, group } = useDatePicker();
  const { openModal } = useAuthModalStore();
  const { activeStoreId } = useStaffActiveStore();
  const [from, to] = dates;
  const cardsQuery = useGetDashboardCardsData(from, to, activeStoreId);
  const chartsQuery = useGetDashboardChartsData(from, to, group, activeStoreId);
  const ordersQuery = useGetAdminOrders("pending", activeStoreId);

  useEffect(() => {
    if (!socket) return;
    const handleOrderPlaced = (order: { orderId: number; total: number; storeId?: number }) => {
      // If scoped to a store, only notify for that store or global
      if (activeStoreId && order.storeId && order.storeId !== activeStoreId) {
        return;
      }
      showNotification({
        title: "New order",
        message: `Order #${order.orderId} · ${formatPrice(order.total)}`,
        color: "brand",
        autoClose: 8000,
        onClick: () => navigate(`/admin/order/${order.orderId}`),
      });
    };
    socket.on("orderPlaced", handleOrderPlaced);
    return () => {
      socket.off("orderPlaced", handleOrderPlaced);
    };
  }, [navigate, socket, activeStoreId]);

  const formattedDates = useMemo(
    () =>
      from && to
        ? `${formatDate(from)} – ${formatDate(to)}`
        : "Select date range",
    [from, to]
  );
  const charts = chartsQuery.data;
  const pendingOrders = ordersQuery.data?.slice(0, 5) ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">
            Operations overview
          </p>
          <h1 className="mt-1 text-page-title-scale">Dashboard</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Monitor performance and stay ahead of incoming orders.
          </p>
        </div>
        <Button
          variant="outline"
          color="dark"
          size="md"
          leftSection={<CalendarRange size={18} />}
          onClick={() =>
            openModal({
              content: <DatePicker />,
              title: "",
              options: { size: 520, padding: "lg", radius: "lg" },
            })
          }
        >
          {formattedDates}
        </Button>
      </div>
      <RefreshIndicator
        active={[cardsQuery, chartsQuery, ordersQuery].some((query) => query.isFetching && !query.isLoading)}
        label="Refreshing dashboard"
      />

      <section aria-labelledby="kpi-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="kpi-title" className="text-sm font-bold uppercase tracking-[0.12em] text-ink-muted">
            Performance
          </h2>
          <span className="text-xs text-ink-muted">Compared with previous period</span>
        </div>
        {cardsQuery.isLoading ? (
          <CardGridSkeleton />
        ) : cardsQuery.isError ? (
          <div className="rounded-card border border-red-200 bg-red-50 p-5 text-sm text-danger">
            Performance metrics could not be loaded.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cardsQuery.data?.map((card) => (
              <DashboardCard key={card.label} card={card} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section
          className="rounded-card border border-border bg-surface p-4 shadow-subtle sm:p-5"
          aria-labelledby="revenue-chart-title"
        >
          <div className="mb-4">
            <h2 id="revenue-chart-title" className="text-card-title-scale">
              Revenue trend
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Gross order value grouped {group}.
            </p>
          </div>
          {chartsQuery.isLoading ? (
            <ChartSkeleton />
          ) : chartsQuery.isError || !charts?.revenueOverTime?.length ? (
            <div className="flex h-80 items-center justify-center text-sm text-ink-muted">
              No revenue data for this period.
            </div>
          ) : (
            <LineChart
              h={320}
              data={charts.revenueOverTime}
              dataKey="period"
              curveType="linear"
              gridAxis="y"
              withLegend
              valueFormatter={(value) => formatPrice(value)}
              series={[{ name: "revenue", label: "Revenue", color: "brand.6" }]}
            />
          )}
        </section>

        <section
          className="rounded-card border border-border bg-surface p-4 shadow-subtle sm:p-5"
          aria-labelledby="orders-chart-title"
        >
          <div className="mb-4">
            <h2 id="orders-chart-title" className="text-card-title-scale">
              Order volume
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Orders received in the selected range.
            </p>
          </div>
          {chartsQuery.isLoading ? (
            <ChartSkeleton />
          ) : chartsQuery.isError || !charts?.ordersOverTime?.length ? (
            <div className="flex h-80 items-center justify-center text-sm text-ink-muted">
              No order data for this period.
            </div>
          ) : (
            <BarChart
              h={320}
              data={charts.ordersOverTime}
              dataKey="period"
              gridAxis="y"
              withLegend
              maxBarWidth={32}
              series={[{ name: "orders", label: "Orders", color: "basil.6" }]}
            />
          )}
        </section>
      </div>

      <section
        className="mt-6 overflow-hidden rounded-card border border-border bg-surface shadow-subtle"
        aria-labelledby="recent-orders-title"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="recent-orders-title" className="text-card-title-scale">
              Pending order queue
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Orders waiting for the kitchen’s next action.
            </p>
          </div>
          <Button
            component={Link}
            to="/admin/orders"
            variant="subtle"
            size="sm"
            rightSection={<ArrowRight size={15} />}
          >
            View all
          </Button>
        </div>
        {ordersQuery.isLoading ? (
          <div className="p-4"><ListSkeleton rows={3} rowHeight={58} /></div>
        ) : ordersQuery.isError ? (
          <p className="p-6 text-sm text-danger">
            The pending order queue could not be loaded.
          </p>
        ) : pendingOrders.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <ClipboardList size={30} className="text-basil" />
            <p className="mt-3 font-semibold text-ink">Queue clear</p>
            <p className="mt-1 text-sm text-ink-muted">
              There are no pending orders right now.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pendingOrders.map((order) => (
              <Link
                key={order.id}
                to={`/admin/order/${order.id}`}
                className="grid gap-3 px-5 py-4 hover:bg-surface-muted/60 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-ink">Order #{order.id}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {order.orderDate
                      ? formatDateTime(order.orderDate, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                      : "Date unavailable"}
                  </p>
                </div>
                <p className="truncate text-sm text-ink-muted">
                  {order.user.fname} {order.user.lname}
                </p>
                <OrderStatus status={order.status} />
                <p className="text-right font-bold tabular-nums text-ink">
                  {formatPrice(order.totalPrice)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboardPage;
