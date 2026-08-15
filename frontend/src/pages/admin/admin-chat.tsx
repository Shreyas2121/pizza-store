import { Chat } from "@/components/common";
import { useParams } from "react-router";

const AdminChat = () => {
  const params = useParams();

  const id = Number(params.id);

  return <Chat width="100%" height="100%" userId={id} />;
};

export default AdminChat;
