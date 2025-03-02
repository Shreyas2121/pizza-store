import Transfer from "@/components/admin/transfer";
import { useGetAllCustomizations } from "@/hooks/customize";
import { useAuthModalStore } from "@/store/modal";
import { Loader } from "@mantine/core";

const Customization = () => {
  const { data: customizations, isLoading } = useGetAllCustomizations();
  const { openModal } = useAuthModalStore();

  const handleManageProducts = (groupId: number) => {
    openModal({
      content: <Transfer groupId={groupId} />,
      title: "Transfer Products",
    });
  };

  const handleEditGroup = (groupId: number) => {};

  const handleDeleteGroup = (groupId: number) => {};

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Customization</h1>
      <div className="space-y-4">
        {customizations?.map((group) => (
          <div
            key={group.id}
            className="border rounded p-4 shadow hover:shadow-lg transition"
          >
            {/* Group Header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">
                {group.name}{" "}
                {group.required && (
                  <span className="text-red-500 text-sm">(required)</span>
                )}
              </h2>
              <div className="space-x-2">
                <button
                  className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition"
                  onClick={() => handleEditGroup(group.id)}
                >
                  Edit
                </button>
                <button
                  className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  onClick={() => handleDeleteGroup(group.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            {/* Options List */}
            <ul className="list-disc ml-5 space-y-1 text-gray-700">
              {group.options?.length > 0 ? (
                group.options.map((opt) => (
                  <li key={opt.id}>
                    {opt.name}
                    {opt.price && ` ($${opt.price})`}
                  </li>
                ))
              ) : (
                <li className="italic text-gray-500">No options available</li>
              )}
            </ul>
            {/* Manage Products Button */}
            <div className="mt-4">
              <button
                className="px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600 transition"
                onClick={() => handleManageProducts(group.id)}
              >
                Manage Products
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Customization;
