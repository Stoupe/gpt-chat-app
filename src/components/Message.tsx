import { type Role } from "@prisma/client";
import ReactMarkdown from "react-markdown";

const Message = ({
  isHighlighted = false,
  senderName,
  senderRole,
  content,
}: {
  isHighlighted?: boolean;
  senderName: string;
  senderRole: Role;
  content: string;
}) => {
  return (
    <div
      className={`rounded-lg p-4 ${isHighlighted ? "bg-red-50" : "bg-gray-50"}`}
    >
      <p className="font-bold">
        {senderName} <span className="font-normal italic">({senderRole})</span>
      </p>
      <div className="prose max-w-full">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default Message;
