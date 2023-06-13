"use client";

import { useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import Prism from "prismjs";
import { useEffect, useState } from "react";
import { ArrowBackIcon } from "~/icons";
import { api } from "~/utils/api";
import { useChat } from "~/hooks/useChat";

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

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const chatId = params.chatId;

  // const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const session = useSession();
  const utils = api.useContext();

  const [isStreamingChatResponse] = useState(false);
  const [streamedMessage, setStreamedMessage] = useState("");

  const {
    chat,
    isLoading: isChatLoading,
    isError: isChatError,
    error,
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
    return (
      <div>
        error loading messages
        <pre>
          <code className="flex-wrap overflow-scroll">
            {JSON.stringify(error, null, 2)}
          </code>
        </pre>
      </div>
    );
  }

  if (!chat || isChatLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="btn-ghost loading btn p-5" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{chat.name}</title>
      </Head>

      <dialog id="edit_system_message_modal" className="modal">
        <form method="dialog" className="modal-box">
          <h3 className="text-lg font-bold">
            Set your system message for the chat
          </h3>
          <textarea
            name="system-message-input"
            id="system-message-input"
            rows={3}
            className="textarea-bordered textarea mt-4 w-full"
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
          <div className="modal-action">
            {/* if there is a button in form, it will close the modal */}
            <button className="btn">Close</button>
          </div>
        </form>
      </dialog>

      <div className="flex h-full max-h-screen flex-col p-5">
        <div className="flex items-center gap-3">
          <Link href={"/"} className="btn-ghost btn gap-2 border-base-200">
            <ArrowBackIcon />
            Home
          </Link>
          <h1 className="text-xl font-bold">{chat.name}</h1>
        </div>

        <div
          className="mt-2 flex grow flex-col gap-2 overflow-y-scroll scroll-smooth"
          id="chat-container"
        >
          {chat.systemMessage && (
            <Message
              isHighlighted
              content={chat.systemMessage}
              senderName="System message"
              senderRole="system"
            />
          )}

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
}
