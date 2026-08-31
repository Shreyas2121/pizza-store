import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  Tabs,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import axios from "axios";
import { Copy, MailPlus, RefreshCw, ShieldCheck, UserPlus, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { getActiveMembershipRole, useAccessMe, useStaffActiveStore } from "@/features/access";
import { error, formatDateTime, success } from "@/shared/lib";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import {
  useAssignStaff,
  useCreateInvitation,
  useRevokeInvitation,
  useRevokeStaff,
  useStaffInvitations,
  useStaffList,
  useUpdateStaff,
} from "../api/staff.queries";
import type { InvitationCreateResponse, StaffMember, StaffRole, StaffStatus } from "../model/staff.types";

const roleLabels: Record<StaffRole, string> = {
  manager: "Manager",
  finance_manager: "Finance manager",
  payroll_manager: "Payroll manager",
  operator: "Operator",
  inventory_staff: "Inventory staff",
};

const privilegedRoles = new Set<StaffRole>([
  "manager",
  "finance_manager",
  "payroll_manager",
]);

const statusColors: Record<StaffStatus, string> = {
  active: "green",
  suspended: "yellow",
  revoked: "gray",
};

const apiErrorMessage = (cause: unknown) => {
  if (!axios.isAxiosError<{ code?: string; message?: string }>(cause)) return "The request could not be completed.";
  const code = cause.response?.data?.code;
  if (code === "LAST_STORE_MANAGER") return "An active store must retain at least one manager. Assign another manager first.";
  if (code === "USER_NOT_FOUND_OR_INVITE_REQUIRED") return "No existing account was found. Send an invitation instead.";
  if (code === "MEMBERSHIP_ALREADY_ACTIVE") return "This person already has an active membership in this store.";
  if (code === "MEMBERSHIP_ROLE_CONFLICT") return "This account already has a different store role. Ask a platform administrator to resolve it.";
  if (code === "MANAGER_ROLE_RESTRICTED") return "Store managers may manage only operators and inventory staff.";
  if (code === "ACTIVE_INVITATION_EXISTS") return "A pending invitation already exists for this email and store.";
  if (code === "INVITATION_DELIVERY_UNAVAILABLE") return "Invitation delivery is unavailable. Try again later or contact a platform administrator.";
  if (code === "INVITATION_RATE_LIMITED") return "Too many invitation attempts were made. Wait a moment before trying again.";
  return cause.response?.data?.message ?? "The request could not be completed.";
};

export function AdminStaffPage() {
  const { activeStoreId } = useStaffActiveStore();
  const { data: access } = useAccessMe();
  const activeRole = getActiveMembershipRole(access, activeStoreId);
  const canManagePrivilegedRoles = activeRole === "admin";
  const roleOptions = useMemo(
    () => [
      ...(canManagePrivilegedRoles
        ? [
            { value: "manager", label: "Manager" },
            { value: "finance_manager", label: "Finance manager" },
            { value: "payroll_manager", label: "Payroll manager" },
          ]
        : []),
      { value: "operator", label: "Operator" },
      { value: "inventory_staff", label: "Inventory staff" },
    ],
    [canManagePrivilegedRoles]
  );
  const [status, setStatus] = useState<StaffStatus>("active");
  const [staffPage, setStaffPage] = useState(1);
  const [invitationPage, setInvitationPage] = useState(1);
  const [formMode, setFormMode] = useState<"assign" | "invite" | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("operator");
  const [developmentUrl, setDevelopmentUrl] = useState<string | null>(null);

  const staff = useStaffList(activeStoreId, status, staffPage);
  const invitations = useStaffInvitations(activeStoreId, invitationPage);
  const assign = useAssignStaff(activeStoreId);
  const invite = useCreateInvitation(activeStoreId);
  const update = useUpdateStaff(activeStoreId);
  const revoke = useRevokeStaff(activeStoreId);
  const revokeInvitation = useRevokeInvitation(activeStoreId);
  const formPending = assign.isPending || invite.isPending;

  const closeForm = () => {
    if (formPending) return;
    setFormMode(null);
    setEmail("");
    setRole("operator");
  };

  const submit = () => {
    const values = { email: email.trim().toLowerCase(), role };
    if (!values.email) return;
    const mutation = formMode === "assign" ? assign : invite;
    mutation.mutate(values, {
      onSuccess: (response) => {
        if (formMode === "invite") {
          const result = response as InvitationCreateResponse;
          setDevelopmentUrl(result.data.developmentUrl ?? null);
        }
        success(formMode === "assign" ? "Staff member assigned." : "Invitation sent.");
        closeForm();
      },
      onError: (cause) => error(apiErrorMessage(cause)),
    });
  };

  const updateMember = (member: StaffMember, changes: { role?: StaffRole; status?: "active" | "suspended" }) => {
    const destructive = changes.status === "suspended" || (changes.role && changes.role !== member.role);
    if (destructive && !window.confirm(`Confirm this change for ${member.user.email}?`)) return;
    update.mutate({ membershipId: member.id, ...changes }, {
      onSuccess: () => success("Staff membership updated."),
      onError: (cause) => error(apiErrorMessage(cause)),
    });
  };

  const revokeMember = (member: StaffMember) => {
    if (!window.confirm(`Revoke ${member.user.email} from this store? Their access will end immediately.`)) return;
    revoke.mutate(member.id, {
      onSuccess: () => success("Staff membership revoked."),
      onError: (cause) => error(apiErrorMessage(cause)),
    });
  };

  const revokePendingInvitation = (invitation: { id: number; email: string }) => {
    if (!window.confirm(`Revoke the pending invitation for ${invitation.email}?`)) return;
    revokeInvitation.mutate(invitation.id, {
      onSuccess: () => success("Invitation revoked."),
      onError: (cause) => error(apiErrorMessage(cause)),
    });
  };

  const resendInvitation = (invitation: { email: string; role: StaffRole }) => {
    invite.mutate(invitation, {
      onSuccess: (response) => {
        const result = response as InvitationCreateResponse;
        setDevelopmentUrl(result.data.developmentUrl ?? null);
        success("A replacement invitation was sent.");
      },
      onError: (cause) => error(apiErrorMessage(cause)),
    });
  };

  if (!activeStoreId) {
    return (
      <section>
        <PageHeader eyebrow="People" title="Store staff" description="Select an active store to manage its staff and invitations." />
        <Paper withBorder radius="lg" p="xl"><Text c="dimmed">Choose a store from the workspace switcher.</Text></Paper>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        eyebrow="People"
        title="Store staff"
        description="Assign existing accounts, invite new staff, and control store access."
        action={<Group gap="sm"><Button variant="default" leftSection={<UserPlus size={16} />} onClick={() => setFormMode("assign")}>Assign user</Button><Button leftSection={<MailPlus size={16} />} onClick={() => setFormMode("invite")}>Invite staff</Button></Group>}
      />

      {!canManagePrivilegedRoles && (
        <Alert mb="md" color="blue" icon={<ShieldCheck size={18} />}>
          Store managers can manage operators and inventory staff. Manager, finance, and payroll role changes require a platform administrator.
        </Alert>
      )}
      {developmentUrl && (
        <Alert mb="md" color="yellow" title="Development invitation link — shown only now" withCloseButton onClose={() => setDevelopmentUrl(null)}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="sm" className="break-all">{developmentUrl}</Text>
            <Button size="xs" variant="light" leftSection={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(developmentUrl)}>Copy</Button>
          </Group>
        </Alert>
      )}

      <Tabs value={status} onChange={(value) => { setStatus((value as StaffStatus | null) ?? "active"); setStaffPage(1); }} mb="md">
        <Tabs.List>{(["active", "suspended", "revoked"] as const).map((value) => <Tabs.Tab key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</Tabs.Tab>)}</Tabs.List>
      </Tabs>

      {staff.isLoading ? <TableSkeleton /> : staff.isError ? (
        <Alert color="red">Staff could not be loaded.</Alert>
      ) : (
        <Paper withBorder radius="lg" className="overflow-hidden">
          <Table.ScrollContainer minWidth={850}>
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Person</Table.Th><Table.Th>Role</Table.Th><Table.Th>Status</Table.Th><Table.Th>Last status change</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {staff.data?.data.map((member) => (
                  <Table.Tr key={member.id}>
                    <Table.Td><Text fw={600}>{member.user.fname} {member.user.lname}</Text><Text size="xs" c="dimmed">{member.user.email}</Text></Table.Td>
                    <Table.Td>{!canManagePrivilegedRoles && privilegedRoles.has(member.role) ? <Badge variant="light">{roleLabels[member.role]}</Badge> : <Select aria-label={`Role for ${member.user.email}`} size="xs" w={180} data={roleOptions} value={member.role} disabled={update.isPending} onChange={(value) => value && updateMember(member, { role: value as StaffRole })} />}</Table.Td>
                    <Table.Td><Badge color={statusColors[member.status]} variant="light">{member.status}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{formatDateTime(member.revokedAt ?? member.suspendedAt ?? member.activatedAt)}</Text></Table.Td>
                    <Table.Td><Group gap="xs">
                      {member.status === "active" ? <Button size="xs" variant="default" disabled={!canManagePrivilegedRoles && privilegedRoles.has(member.role)} onClick={() => updateMember(member, { status: "suspended" })}>Suspend</Button> : member.status === "suspended" ? <Button size="xs" variant="default" disabled={!canManagePrivilegedRoles && privilegedRoles.has(member.role)} onClick={() => updateMember(member, { status: "active" })}>Reactivate</Button> : null}
                      {member.status !== "revoked" && <Button size="xs" color="red" variant="subtle" leftSection={<UserX size={14} />} disabled={!canManagePrivilegedRoles && privilegedRoles.has(member.role)} onClick={() => revokeMember(member)}>Revoke</Button>}
                    </Group></Table.Td>
                  </Table.Tr>
                ))}
                {!staff.data?.data.length && <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="xl">No {status} staff members.</Text></Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {(staff.data?.meta.totalPages ?? 0) > 1 && <Group justify="center" p="md"><Pagination value={staffPage} total={staff.data?.meta.totalPages ?? 1} onChange={setStaffPage} /></Group>}
        </Paper>
      )}

      <Text fw={700} size="lg" mt="xl" mb="sm">Invitations</Text>
      {invitations.isLoading ? <TableSkeleton /> : invitations.isError ? <Alert color="red">Invitations could not be loaded.</Alert> : (
        <Paper withBorder radius="lg" className="overflow-hidden">
          <Table.ScrollContainer minWidth={760}><Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead><Table.Tr><Table.Th>Email</Table.Th><Table.Th>Role</Table.Th><Table.Th>Expires</Table.Th><Table.Th>Status</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{invitations.data?.data.map((invitation) => {
              const pending = !invitation.acceptedAt && !invitation.revokedAt && new Date(invitation.expiresAt).getTime() > Date.now();
              const invitationStatus = invitation.acceptedAt ? "Accepted" : invitation.revokedAt ? "Revoked" : pending ? "Pending" : "Expired";
              return <Table.Tr key={invitation.id}><Table.Td>{invitation.email}</Table.Td><Table.Td><Badge variant="light">{roleLabels[invitation.role]}</Badge></Table.Td><Table.Td>{formatDateTime(invitation.expiresAt)}</Table.Td><Table.Td><Badge color={pending ? "yellow" : "gray"}>{invitationStatus}</Badge></Table.Td><Table.Td>{pending && <Group gap="xs"><Button size="xs" variant="default" leftSection={<RefreshCw size={14} />} onClick={() => resendInvitation(invitation)}>Resend</Button><Button size="xs" color="red" variant="subtle" onClick={() => revokePendingInvitation(invitation)}>Revoke</Button></Group>}</Table.Td></Table.Tr>;
            })}{!invitations.data?.data.length && <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="xl">No invitations found.</Text></Table.Td></Table.Tr>}</Table.Tbody>
          </Table></Table.ScrollContainer>
          {(invitations.data?.meta.totalPages ?? 0) > 1 && <Group justify="center" p="md"><Pagination value={invitationPage} total={invitations.data?.meta.totalPages ?? 1} onChange={setInvitationPage} /></Group>}
        </Paper>
      )}

      <Modal opened={formMode !== null} onClose={closeForm} title={formMode === "assign" ? "Assign an existing user" : "Invite staff"} centered>
        <Text size="sm" c="dimmed" mb="md">{formMode === "assign" ? "The user must already have an account." : "A single-use invitation expires after 48 hours."}</Text>
        <TextInput label="Email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} type="email" autoComplete="email" required disabled={formPending} />
        <Select mt="md" label="Role" data={roleOptions} value={role} onChange={(value) => value && setRole(value as StaffRole)} allowDeselect={false} disabled={formPending} />
        <Group justify="flex-end" mt="xl"><Button variant="default" onClick={closeForm} disabled={formPending}>Cancel</Button><Button onClick={submit} loading={formPending} disabled={!email.trim()}>{formMode === "assign" ? "Assign" : "Send invitation"}</Button></Group>
      </Modal>
    </section>
  );
}

export default AdminStaffPage;
