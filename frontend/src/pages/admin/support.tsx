import { useState } from "react";
import { Button, Select, Skeleton } from "@mantine/core";
import { chatStatus, ChatStatus } from "@/lib";
import { CHAT_API_HOOKS } from "@/hooks";
import { columns, getPriority, getWaitTime } from "@/components/admin";
import { DataTable } from "@/shared/ui";

import { PageHeader } from "@/components/common";
import SupportStatus from "@/components/admin/support/support-status";
import SupportActions from "@/components/admin/support/actions";
import { RotateCcw } from "lucide-react";

const Support = () => {
  const [statusFilter, setStatusFilter] = useState<ChatStatus>("pending");
  const { data, isLoading, isError } = CHAT_API_HOOKS.useGetSupportRequests(statusFilter);
  const filter = <div className="flex w-full items-end gap-2 sm:w-auto"><Select label="Queue status" aria-label="Filter support queue by status" data={chatStatus} className="min-w-44 flex-1" value={statusFilter} onChange={(value) => setStatusFilter((value as ChatStatus) || "pending")} /><Button variant="default" px="sm" aria-label="Clear support filters" disabled={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}><RotateCcw size={16} /></Button></div>;

  return (
    <div>
      <PageHeader eyebrow="Customer care" title="Support queue" description="Prioritize waiting customers, understand their topic, and continue active conversations." />
      {isLoading ? <Skeleton h={420} radius="lg" /> : isError ? <div className="surface-card p-8 text-center text-danger">Support requests could not be loaded.</div> : (
        <DataTable columns={columns} data={data ?? []} keyName="userFullName" text="customers" searchLabel="Search customers" Component={filter} emptyTitle="This queue is clear" emptyDescription="There are no support sessions with this status." renderMobileCard={(session) => {
          const priority = getPriority(session);
          return <div><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{session.user.fname} {session.user.lname}</p><p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{session.subject || "General support"}</p></div><SupportStatus status={session.status} /></div><div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3"><p className="text-xs text-ink-muted"><span className={`font-semibold ${priority.color === "red" ? "text-danger" : "text-ink"}`}>{priority.label} priority</span> · waiting {getWaitTime(session.createdAt)}</p><SupportActions chatSession={session} /></div></div>;
        }} />
      )}
    </div>
  );
};

export default Support;
