import type { StoreRole } from "../../access/model/access.types";

export type StaffRole = StoreRole;
export type StaffStatus = "active" | "suspended" | "revoked";

export interface StaffMember {
  id: number;
  userId: number;
  storeId: number;
  role: StaffRole;
  status: StaffStatus;
  activatedAt: string;
  suspendedAt: string | null;
  revokedAt: string | null;
  user: { id: number; fname: string; lname: string; email: string };
}

export interface StaffInvitation {
  id: number;
  email: string;
  role: StaffRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StaffListResponse { data: StaffMember[]; meta: PageMeta }
export interface InvitationListResponse { data: StaffInvitation[]; meta: PageMeta }
export interface InvitationCreateResponse {
  data: { invitation: StaffInvitation; developmentUrl?: string };
  message: string;
}
