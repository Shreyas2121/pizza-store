interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditEntry {
  id: number;
  actorUserId: number | null;
  actorEmailSnapshot: string | null;
  platformRole: string | null;
  storeId: number | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: "success" | "failure" | "denied";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditListResponse { data: AuditEntry[]; meta: PageMeta }
