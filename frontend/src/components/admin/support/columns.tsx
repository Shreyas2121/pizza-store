import { ColumnDef } from "@tanstack/react-table";
import SupportActions from "./actions";
import SupportStatus from "./support-status";
import { ChatSessionWithUser } from "@/lib";

export const columns: ColumnDef<ChatSessionWithUser>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    // Example of deriving a user’s full name from the row data
    id: "userFullName",
    header: "User",
    accessorFn: (row) => `${row.user.fname} ${row.user.lname}`,
    // optional cell styling or other properties
  },
  {
    accessorKey: "subject",
    header: "Subject",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      return <SupportStatus status={row.original.status} />;
    },
  },
  {
    // We can format dates here
    id: "createdAt",
    header: "Created At",
    accessorFn: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    accessorKey: "id",
    header: "Actions",
    cell: ({ row }) => {
      return <SupportActions chatSession={row.original} />;
    },
  },
];
