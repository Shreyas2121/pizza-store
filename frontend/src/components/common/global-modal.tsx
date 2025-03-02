import { Modal } from "@mantine/core";
import { useAuthModalStore } from "../../store/modal";

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
