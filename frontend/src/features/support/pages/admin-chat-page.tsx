import { useParams } from "react-router";
import { Chat } from "@/components/common";

export const AdminChatPage = () => {
  const params = useParams();
  const id = Number(params.id);

  return <Chat width="100%" height="100%" userId={id} />;
};

export default AdminChatPage;
