import type { User, Role } from "@/features/auth";

export type ChatStatus = "open" | "close" | "rejected" | "pending";

export const chatStatus: {
  label: string;
  value: ChatStatus;
}[] = [
  {
    label: "Pending",
    value: "pending",
  },
  {
    label: "Open",
    value: "open",
  },
  {
    label: "Close",
    value: "close",
  },
  {
    label: "Rejected",
    value: "rejected",
  },
];

export interface ChatSession {
  status: ChatStatus;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  subject: string | null;
}

export interface ChatSessionWithUser extends ChatSession {
  user: User;
}

export interface Message {
  type: Role;
  timestamp: string;
  message: string;
  id: number;
}
