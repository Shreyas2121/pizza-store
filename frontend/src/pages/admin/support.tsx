import { useState } from "react";
import { Loader, Select, Title, Container } from "@mantine/core";
import { chatStatus, ChatStatus } from "@/lib";
import { CHAT_API_HOOKS } from "@/hooks";
import { columns } from "@/components/admin";
import { DataTable } from "@/components/table";

const Support = () => {
  // Track the selected status
  const [statusFilter, setStatusFilter] = useState<ChatStatus>("pending");

  // Fetch support requests based on the selected status
  const { data, isLoading } =
    CHAT_API_HOOKS.useGetSupportRequests(statusFilter);

  if (isLoading) {
    return (
      <Container>
        <Loader />
      </Container>
    );
  }

  return (
    <div>
      <Title order={2} mb="md">
        Support Requests
      </Title>

      <Select
        label="Filter by Status"
        data={chatStatus}
        className="w-1/4"
        value={statusFilter}
        onChange={(val) => setStatusFilter((val as ChatStatus) || "pending")}
        placeholder="Choose status"
        mb="md"
      />

      <DataTable columns={columns} data={data!} />
    </div>
  );
};

export default Support;
