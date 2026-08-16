import { useAuthModalStore } from "@/shared/model";
import { Modal } from "@mantine/core";

export const GlobalModal = () => {
  const { opened, content, closeModal, title, options } = useAuthModalStore();

  return (
    <Modal
      title={title}
      closeOnClickOutside={options?.closeOnClickOutside ?? false}
      opened={opened}
      onClose={closeModal}
      size={options?.size ?? "lg"}
      centered={options?.centered ?? true}
      fullScreen={options?.fullScreen}
      padding={options?.padding}
      radius={options?.radius}
    >
      {content}
    </Modal>
  );
};

export default GlobalModal;
