import { Table } from "@mantine/core";

export const EmptyTable = ({ length }: { length: number }) => {
  return (
    <Table.Tr>
      <Table.Td colSpan={length} className="h-24 text-center">
        No results.
      </Table.Td>
    </Table.Tr>
  );
};

export default EmptyTable;
