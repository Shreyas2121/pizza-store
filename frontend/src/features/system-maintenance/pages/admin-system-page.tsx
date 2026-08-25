import {
  Alert,
  Button,
  Modal,
  Paper,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { DatabaseZap, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { error, success } from "@/shared/lib";
import { PageHeader } from "@/shared/ui";
import {
  CLEAR_ALL_CONFIRMATION,
  useClearAllApplicationData,
} from "../api/system-maintenance.mutations";

export function AdminSystemPage() {
  const queryClient = useQueryClient();
  const clearAll = useClearAllApplicationData();
  const [opened, setOpened] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const confirmed = confirmation === CLEAR_ALL_CONFIRMATION;

  const close = () => {
    if (clearAll.isPending) return;
    setOpened(false);
    setConfirmation("");
  };

  const submit = () => {
    if (!confirmed) return;
    clearAll.mutate(undefined, {
      onSuccess: (response) => {
        success(
          `${response.data.deletedNonAdminUsers} non-admin users and all application data were cleared.`
        );
        queryClient.clear();
        setOpened(false);
        setConfirmation("");
      },
      onError: (cause) => {
        const message = axios.isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        error(message ?? "Application data could not be cleared.");
      },
    });
  };

  return (
    <section>
      <PageHeader
        eyebrow="Administration"
        title="System maintenance"
        description="Administrative controls for resetting application data."
      />

      <Paper withBorder radius="lg" p="xl" className="border-red-200">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ThemeIcon color="red" variant="light" size={52} radius="xl">
            <DatabaseZap size={26} />
          </ThemeIcon>
          <div className="min-w-0 flex-1">
            <Text fw={700} size="xl" c="red">
              Danger zone
            </Text>
            <Text c="dimmed" mt={4} maw={760}>
              Permanently clear stores, catalogue products, menus,
              customizations, inventory, orders, payments, coupons, customer
              accounts, carts, addresses, and support chats.
            </Text>

            <Alert
              color="red"
              variant="light"
              icon={<ShieldAlert size={19} />}
              title="Admin accounts are the only records preserved"
              mt="lg"
            >
              This cannot be undone. Uploaded media files on the server are not
              removed, but every associated database record is deleted.
            </Alert>

            <Button
              color="red"
              mt="xl"
              leftSection={<Trash2 size={17} />}
              onClick={() => setOpened(true)}
            >
              Clear all data
            </Button>
          </div>
        </div>
      </Paper>

      <Modal
        opened={opened}
        onClose={close}
        title="Permanently clear all application data?"
        centered
        closeOnClickOutside={!clearAll.isPending}
        closeOnEscape={!clearAll.isPending}
        withCloseButton={!clearAll.isPending}
        overlayProps={{ backgroundOpacity: 0.5, blur: 3 }}
      >
        <Text size="sm" c="dimmed">
          All data except admin user accounts will be permanently deleted. Type
          the phrase below exactly to continue.
        </Text>
        <Text mt="md" fw={700} ff="monospace">
          {CLEAR_ALL_CONFIRMATION}
        </Text>
        <TextInput
          mt="sm"
          label="Confirmation"
          placeholder={CLEAR_ALL_CONFIRMATION}
          value={confirmation}
          onChange={(event) => setConfirmation(event.currentTarget.value)}
          autoComplete="off"
          disabled={clearAll.isPending}
          error={
            confirmation.length > 0 && !confirmed
              ? "The confirmation phrase does not match"
              : undefined
          }
        />
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="default" onClick={close} disabled={clearAll.isPending}>
            Cancel
          </Button>
          <Button
            color="red"
            leftSection={<Trash2 size={16} />}
            disabled={!confirmed}
            loading={clearAll.isPending}
            onClick={submit}
          >
            Permanently clear everything
          </Button>
        </div>
      </Modal>
    </section>
  );
}

export default AdminSystemPage;
