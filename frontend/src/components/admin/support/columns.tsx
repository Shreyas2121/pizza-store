import { ColumnDef } from "@tanstack/react-table";
import SupportActions from "./actions";
import SupportStatus from "./support-status";
import { ChatSessionWithUser } from "@/lib";
import { Badge } from "@mantine/core";

export const getWaitTime = (date: Date | string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
};

export const getPriority = (session: ChatSessionWithUser) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 60000));
  if (session.status === "pending" && minutes >= 30) return { label: "High", color: "red" };
  if (session.status === "pending" && minutes >= 10) return { label: "Medium", color: "yellow" };
  return { label: "Normal", color: "gray" };
};

export const columns: ColumnDef<ChatSessionWithUser>[] = [
  { header: "Priority", id: "priority", enableSorting: false, cell: ({ row }) => { const priority = getPriority(row.original); return <Badge size="sm" variant="outline" color={priority.color}>{priority.label}</Badge>; } },
  { id: "userFullName", header: "Customer", accessorFn: (row) => `${row.user.fname} ${row.user.lname}`, cell: ({ row }) => <div><p className="font-medium">{row.original.user.fname} {row.original.user.lname}</p><p className="text-xs text-ink-muted">{row.original.user.email}</p></div> },
  { accessorKey: "subject", header: "Topic", cell: ({ row }) => <span className="line-clamp-2 min-w-48">{row.original.subject || "General support"}</span> },
  { id: "age", header: "Waiting", accessorFn: (row) => new Date(row.createdAt).getTime(), cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{getWaitTime(row.original.createdAt)}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <SupportStatus status={row.original.status} /> },
  { id: "actions", header: "", enableSorting: false, cell: ({ row }) => <SupportActions chatSession={row.original} /> },
];
