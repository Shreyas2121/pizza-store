import { useParams } from "react-router";
import { Chat } from "../components/chat";


export const AdminChatPage = () => {
  const params = useParams();
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) return <p>Invalid customer ID.</p>;
  return <Chat key={id} width="100%" height="100%" userId={id} />;
};

export default AdminChatPage;
