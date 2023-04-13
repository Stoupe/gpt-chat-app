import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import {
  ChatCompletionRequestMessageRoleEnum,
  type ChatCompletionRequestMessage,
} from "openai";
import Prism from "prismjs";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowBackIcon, ChatIcon, DeleteIcon, SettingsIcon } from "~/icons";
import { api } from "~/utils/api";
import { useChat, useFetchChat } from "../../hooks/useChat";
import { z } from "zod";

import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-yaml";

interface NextPageProps {
  chatId: string;
}

const ChatPage: NextPage<NextPageProps> = ({ chatId }) => {
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const session = useSession();

  const [input, setInput] = useState("");
  const [isStreamingChatResponse, setIsStreamingChatResponse] = useState(false);

  const { deleteChat, createMultipleMessages } = useChat(chatId);

  const {
    chat,
    isError: isChatError,
    isLoading: isChatLoading,
    addMessage,
    editMessageContent,
  } = useFetchChat(chatId);

  const { data: plaintextApiKey } = api.user.getApiKey.useQuery();

  useEffect(() => {
    // Only run the code syntax highlighting if we're not streaming a response.
    // This causes code blocks to look a bit strange when streaming, but it's even
    // more buggy if we don't do this.
    if (!isStreamingChatResponse) {
      Prism.highlightAll();
    }
  }, [chat, isStreamingChatResponse, isChatLoading]);

  /**
   * Responsible for combining the given messages and the user's input into a conversation object,
   * formatted as a ChatCompletionRequestMessage[]. It then sends the conversation to our API endpoint
   * to generate a response from the OpenAI API, and handles parsing the streamed response and updating
   * the chat state.
   */
  const streamChatResponse = async (
    // The messages to send to the OpenAI API
    // We only care about the name, content and role of each message
    messages: ChatCompletionRequestMessage[]
  ) => {
    setIsStreamingChatResponse(true);

    // console.log("body being sent");
    // console.log(body);

    // Make the request to our API endpoint to generate a response from the OpenAI API
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OPENAI-API-KEY": plaintextApiKey ?? "",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const data = response.body;
    if (!data) {
      return;
    }

    // Parse the streamed response and update the chat state
    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let assistantMsg = "";

    addMessage({
      // This id will be updated when the message is created in the database
      id: "temp_assistant_message_id",
      content: "",
      role: ChatCompletionRequestMessageRoleEnum.Assistant,
      name: "ChatGPT", //TODO: use name of model?
      createdAt: new Date(),
      updatedAt: new Date(),
      chatId: chatId,
    });

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);

      editMessageContent(
        "temp_assistant_message_id",
        assistantMsg + chunkValue
      );

      // This is used for creating the new message in the database below
      assistantMsg += chunkValue;
    }

    setIsStreamingChatResponse(false);

    // Add the user's input message and the assistant's response message to the database
    createMultipleMessages({
      chatId: chatId,
      messages: [
        {
          content: input.trim(),
          role: "user",
          name: session.data?.user.name ?? "user",
        },
        {
          content: assistantMsg,
          role: "assistant",
          name: "ChatGPT", //TODO: use name of model?
        },
      ],
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chatId || !chat || !session.data || input.trim().length < 1) return;

    /**
     * Here we combine the messages and the user's input into a conversation object
     *
     * - Previous messages come first
     * - Then add the user's input message
     * - Then add the system message last
     */
    const conversation: ChatCompletionRequestMessage[] = [
      ...chat.messages
        .filter((msg) => msg.role !== "system")
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
        .map((msg) => ({
          content: msg.content,
          role: msg.role,
          name: msg.name,
        })),
      {
        content: input.trim(),
        role: "user",
        name: session.data?.user.name ?? "user",
      },
      ...chat.messages
        .filter((msg) => msg.role === "system")
        .map((msg) => ({
          content: msg.content,
          role: msg.role,
          name: msg.name,
        })),
    ];

    // Send the message thread to openai for a response
    void streamChatResponse(conversation);

    // Optimistically update the UI by adding the input message to the chat state
    addMessage({
      id: "temp_user_message_id",
      content: input,
      role: "user",
      name: session.data.user.name ?? "user",
      chatId: chatId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    setInput("");
  };

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
          <form
            onSubmit={(e) => {
              e.preventDefault();

              // TODO: Get this in a typesafe way, probably by using a controlled input.
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const textAreaContent: string =
                e.currentTarget["system-message-input"].value; // eslint-disable-line @typescript-eslint/no-unsafe-member-access

              createMultipleMessages({
                messages: [
                  {
                    content: textAreaContent,
                    role: "system",
                    name: "System",
                  },
                ],
                chatId: chat.id,
              });
            }}
          >
            <textarea
              name="system-message-input"
              id="system-message-input"
              rows={3}
              className="textarea-bordered textarea my-4 w-full"
              defaultValue={
                chat.messages.find((msg) => msg.role === "system")?.content ??
                ""
              }
            />
            <button type="submit" className="btn">
              Set system message
            </button>
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

        <div className="mt-2 flex w-full grow flex-col gap-2 overflow-y-scroll">
          {chat.messages
            .filter((msg) => msg.role !== "system")
            .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
            .map((message) => (
              <div className="rounded-lg bg-gray-50 p-4" key={message.id}>
                <p className="font-bold">
                  {message.name}{" "}
                  <span className="font-normal italic">({message.role})</span>
                </p>
                <div className="prose max-w-full prose-pre:whitespace-pre-wrap">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            ))}
        </div>

        <form
          className="form-control flex flex-row items-center gap-2 pt-6"
          onSubmit={handleSubmit}
        >
          <textarea
            ref={chatInputRef}
            className="input textarea-bordered textarea w-full resize-y"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              // Submit the form when the user presses enter (without shift)
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />

          <button
            disabled={isStreamingChatResponse}
            className={`btn ${
              isStreamingChatResponse ? "loading" : ""
            } btn px-6`}
            type="submit"
          >
            send
          </button>

          <div className="dropdown-top dropdown-end dropdown">
            <label tabIndex={0} className="btn-ghost btn-square btn">
              <SettingsIcon />
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu rounded-box mb-2 w-72 bg-base-100 p-2 shadow"
            >
              <li>
                <label htmlFor="edit-system-message-modal">
                  <ChatIcon />
                  set system message
                </label>
              </li>
              <li>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (!chatId) return;
                    void deleteChat({ chatId });
                  }}
                  className="hover:text-error"
                  disabled={isStreamingChatResponse}
                >
                  <DeleteIcon />
                  delete chat
                </button>
              </li>
            </ul>
          </div>
        </form>
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
