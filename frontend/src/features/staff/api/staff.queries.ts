import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accessKeys } from "@/features/access";
import { API } from "@/shared/api";
import type {
  InvitationCreateResponse,
  InvitationListResponse,
  StaffListResponse,
  StaffRole,
  StaffStatus,
} from "../model/staff.types";

export const staffKeys = {
  all: ["staff"] as const,
  list: (storeId: number | null, status: StaffStatus, page: number) =>
    ["staff", "list", storeId, status, page] as const,
  invitations: (storeId: number | null, page: number) =>
    ["staff", "invitations", storeId, page] as const,
};

export const useStaffList = (storeId: number | null, status: StaffStatus, page: number) =>
  useQuery({
    queryKey: staffKeys.list(storeId, status, page),
    queryFn: async () => (await API.get<StaffListResponse>(`/stores/${storeId}/staff`, {
      params: { status, page, limit: 20 },
    })).data,
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

export const useStaffInvitations = (storeId: number | null, page: number) =>
  useQuery({
    queryKey: staffKeys.invitations(storeId, page),
    queryFn: async () => (await API.get<InvitationListResponse>(`/stores/${storeId}/staff/invitations`, {
      params: { page, limit: 10 },
    })).data,
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

const useStaffMutation = <TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>
) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: staffKeys.all }),
        client.invalidateQueries({ queryKey: ["audit"] }),
        client.invalidateQueries({ queryKey: accessKeys.all }),
        client.invalidateQueries({ queryKey: ["stores"] }),
        client.invalidateQueries({ queryKey: ["inventory"] }),
        client.invalidateQueries({ queryKey: ["order-adminAll"] }),
      ]);
    },
  });
};

export const useAssignStaff = (storeId: number | null) =>
  useStaffMutation(async (values: { email: string; role: StaffRole }) =>
    (await API.post(`/stores/${storeId}/staff`, values)).data
  );

export const useCreateInvitation = (storeId: number | null) =>
  useStaffMutation(async (values: { email: string; role: StaffRole }) =>
    (await API.post<InvitationCreateResponse>(`/stores/${storeId}/staff/invitations`, values)).data
  );

export const useUpdateStaff = (storeId: number | null) =>
  useStaffMutation(async (input: { membershipId: number; role?: StaffRole; status?: "active" | "suspended" }) =>
    (await API.patch(`/stores/${storeId}/staff/${input.membershipId}`, {
      role: input.role,
      status: input.status,
    })).data
  );

export const useRevokeStaff = (storeId: number | null) =>
  useStaffMutation(async (membershipId: number) =>
    (await API.delete(`/stores/${storeId}/staff/${membershipId}`)).data
  );

export const useRevokeInvitation = (storeId: number | null) =>
  useStaffMutation(async (invitationId: number) =>
    (await API.delete(`/stores/${storeId}/staff/invitations/${invitationId}`)).data
  );

export const useAcceptInvitation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => (await API.post("/staff-invitations/accept", { token })).data,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: accessKeys.all }),
        client.invalidateQueries({ queryKey: staffKeys.all }),
      ]);
    },
  });
};
