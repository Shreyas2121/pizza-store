import { useAuthModalStore } from "@/store";
import { Modal } from "@mantine/core";

const GlobalModal = () => {
  const { opened, content, closeModal, title } = useAuthModalStore();

  return (
    <Modal
      title={title}
      closeOnClickOutside={false}
      opened={opened}
      onClose={closeModal}
      size={"lg"}
    >
      {content}
    </Modal>
  );
};

export default GlobalModal;
