import { Alert, Button, Paper, Text, ThemeIcon } from "@mantine/core";
import axios from "axios";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { LoginForm, useUser } from "@/features/auth";
import { error, success } from "@/shared/lib";
import { useAcceptInvitation } from "../api/staff.queries";

const acceptanceError = (cause: unknown) => {
  if (!axios.isAxiosError<{ code?: string; message?: string }>(cause)) return "The invitation could not be accepted.";
  const code = cause.response?.data?.code;
  if (code === "INVITATION_EMAIL_MISMATCH") return "Sign in with the same email address that received this invitation.";
  if (code === "INVITATION_EXPIRED") return "This invitation has expired. Ask the store manager to resend it.";
  if (code === "INVITATION_ALREADY_USED" || code === "MEMBERSHIP_ALREADY_ACTIVE") return "This invitation has already been used.";
  if (code === "INVITATION_REVOKED") return "This invitation was revoked. Ask the store manager for a new one.";
  return cause.response?.data?.message ?? "The invitation could not be accepted.";
};

export function AcceptStaffInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useUser();
  const accept = useAcceptInvitation();
  const [accepted, setAccepted] = useState(false);
  const token = params.get("token") ?? "";

  if (!token && !accepted) {
    return <div className="mx-auto max-w-xl py-12"><Alert color="red" title="Invitation link is incomplete">Request a new invitation from the store manager.</Alert></div>;
  }

  if (!isLoggedIn || !user) {
    return (
      <div className="mx-auto max-w-md py-10">
        <Paper withBorder radius="xl" p="xl" shadow="sm">
          <Alert color="blue" mb="lg" icon={<KeyRound size={18} />} title="Authentication required">
            Sign in with the invited email address, or create an account first. The invitation will remain on this page.
          </Alert>
          <LoginForm />
        </Paper>
      </div>
    );
  }

  const submit = () => accept.mutate(token, {
    onSuccess: () => {
      setAccepted(true);
      success("Invitation accepted. Your store access is ready.");
      navigate("/staff-invitations/accept", { replace: true });
    },
    onError: (cause) => error(acceptanceError(cause)),
  });

  return (
    <div className="mx-auto max-w-xl py-12">
      <Paper withBorder radius="xl" p="xl" ta="center" shadow="sm">
        <ThemeIcon mx="auto" size={58} radius="xl" color={accepted ? "green" : "brand"} variant="light">
          {accepted ? <CheckCircle2 size={30} /> : <KeyRound size={28} />}
        </ThemeIcon>
        <Text fw={800} size="xl" mt="lg">{accepted ? "Store access activated" : "Accept staff invitation"}</Text>
        <Text c="dimmed" mt="sm">
          {accepted ? "You can now open the operations workspace." : <>You are signed in as <strong>{user.email}</strong>. Accept only if this is the invited address.</>}
        </Text>
        {accepted ? <Button component={Link} to="/admin" mt="xl">Open operations</Button> : <Button mt="xl" loading={accept.isPending} onClick={submit}>Accept invitation</Button>}
      </Paper>
    </div>
  );
}

export default AcceptStaffInvitationPage;
