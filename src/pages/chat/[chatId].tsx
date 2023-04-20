import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import Prism from "prismjs";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowBackIcon } from "~/icons";
import { api } from "~/utils/api";
import { useChat } from "../../hooks/useChat";

import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-yaml";
import ChatInputSection from "~/components/ChatInputSection";
import Message from "~/components/Message";

interface NextPageProps {
  chatId: string;
}

const ChatPage: NextPage<NextPageProps> = ({ chatId }) => {
  // const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const session = useSession();
  const utils = api.useContext();

  const [isStreamingChatResponse] = useState(false);
  const [streamedMessage, setStreamedMessage] = useState("");

  const {
    chat,
    isLoading: isChatLoading,
    isError: isChatError,
    updateSystemMessage,
  } = useChat(chatId);

  useEffect(() => {
    if (!isStreamingChatResponse) {
      Prism.highlightAll();
    }

    // Scroll to the bottom of the chat
    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [chat, isStreamingChatResponse]);

  if (!session) {
    return null;
  }

  if (isChatError) {
    return <div>error loading messages</div>;
  }

  if (!chat || isChatLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="loading btn-ghost btn p-5" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{chat.name}</title>
      </Head>

      <input
        type="checkbox"
        id="edit-system-message-modal"
        className="modal-toggle"
      />
      <label
        htmlFor="edit-system-message-modal"
        className="modal cursor-pointer"
      >
        <label className="modal-box relative" htmlFor="">
          <h3 className="text-lg font-bold">
            Set your system message for the chat
          </h3>
          <form>
            <textarea
              name="system-message-input"
              id="system-message-input"
              rows={3}
              className="textarea-bordered textarea my-4 w-full"
              value={chat.systemMessage ?? ""}
              onChange={(e) => {
                utils.chat.get.setData(
                  { chatId },
                  {
                    ...chat,
                    systemMessage: e.target.value,
                  }
                );
                utils;
              }}
              onBlur={() => {
                updateSystemMessage({
                  chatId: chat.id,
                  message: chat.systemMessage,
                });
              }}
            />
          </form>
        </label>
      </label>

      <div className="flex max-h-screen w-full flex-col p-5">
        <div className="flex items-center gap-3">
          <Link href={"/"} className="btn-ghost btn gap-2 border-base-200">
            <ArrowBackIcon />
            Home
          </Link>
          <h1 className="text-xl font-bold">{chat.name}</h1>
        </div>

        {chat.systemMessage && (
          <div className="mt-2">
            <Message
              isHighlighted
              content={chat.systemMessage}
              senderName="System message"
              senderRole="system"
            />
          </div>
        )}

        <div
          className="mt-2 flex grow flex-col gap-2 overflow-y-scroll"
          id="chat-container"
        >
          {chat.messages
            .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
            .map((message) => (
              <Message
                key={message.id}
                senderName={message.name}
                senderRole={message.role}
                content={message.content}
              />
            ))}
          {streamedMessage && (
            <Message
              senderName={"ChatGPT"}
              senderRole={"assistant"}
              content={streamedMessage}
            />
          )}
        </div>

        <ChatInputSection
          chatId={chat.id}
          setStreamedMessage={setStreamedMessage}
        />
      </div>
    </>
  );
};

ChatPage.getInitialProps = (ctx) => {
  const { chatId } = ctx.query;
  const chatIdString = z.string().parse(chatId);
  return { chatId: chatIdString };
};

export default ChatPage;
