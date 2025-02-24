import { Modal } from "@mantine/core";
import { useAuthModalStore } from "../store/modal";

const GlobalModal = () => {
  const { opened, content, closeModal } = useAuthModalStore();

  return (
    <Modal closeOnClickOutside={false} opened={opened} onClose={closeModal}>
      {content}
    </Modal>
  );
};

export default GlobalModal;
