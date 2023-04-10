import { type Message } from "@prisma/client";
import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  ChatCompletionRequestMessageRoleEnum,
  type ChatCompletionRequestMessage,
} from "openai";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useChat } from "../../hooks/useChat";
import Link from "next/link";

const ChatPage: NextPage = () => {
  //Get chat id from url path (nextjs)
  const { query } = useRouter();
  const chatId = query.chatId as string;

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const session = useSession();

  const [input, setInput] = useState("");
  const [isStreamingChatResponse, setIsStreamingChatResponse] = useState(false);

  const {
    chat,
    setChat,
    isChatLoading,
    isChatError,
    deleteChat,
    createMultipleMessages,
  } = useChat(chatId);

  /**
   * Responsible for combining the given messages and the user's input into a conversation object,
   * formatted as a ChatCompletionRequestMessage[]. It then sends the conversation to our API endpoint
   * to generate a response from the OpenAI API, and handles parsing the streamed response and updating
   * the chat state.
   */
  const streamChatResponse = async (
    // The messages to send to the OpenAI API
    // We only care about the name, content and role of each message
    messages: ChatCompletionRequestMessage[] & Record<string, unknown>[]
  ) => {
    setIsStreamingChatResponse(true);

    // Combine the messages and the user's input into a conversation object
    const body: ChatCompletionRequestMessage[] = [
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
        name: message.name,
      })),
    ];

    // Make the request to our API endpoint to generate a response from the OpenAI API
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);

      setChat((prev) => {
        if (!prev) {
          return prev;
        }

        // Check to see if we've already started creating the new message in the chat state.
        // If we have, we'll update the message with the next chunk value.
        // If we haven't, we'll create a new message with the first chunk value.
        const tempMessageIndex = prev.messages.findIndex(
          (message) => message.id === "temp_assistant_message_id"
        );

        // If we haven't started creating the new message from the chunks yet,
        // create a new message with the first chunk value
        if (tempMessageIndex === -1) {
          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                // This id will be updated when the message is created in the database
                id: "temp_assistant_message_id",
                content: chunkValue,
                role: ChatCompletionRequestMessageRoleEnum.Assistant,
                name: "ChatGPT", //TODO: use name of model?
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          };
        }

        // If we have already started creating the new message from the chunks,
        // update the message with the next chunk value
        const tempMessage = prev.messages[tempMessageIndex];
        if (!tempMessage) {
          // This should never happen as we've already checked if the temp message exists
          return prev;
        }

        // Update the message with the next chunk value
        return {
          ...prev,
          messages: [
            // Copy all messages before the temp message
            ...prev.messages.slice(0, tempMessageIndex),
            // Update the temp message with the next chunk value
            {
              ...tempMessage,
              content: `${tempMessage?.content ?? ""}${chunkValue}`,
              updatedAt: new Date(),
            },
            // Copy any messages after the temp message (there shoudn't be any, but just in case)
            ...prev.messages.slice(tempMessageIndex + 1),
          ],
        };
      });

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
    if (!chatId || !chat || !session.data) return;

    const msgs = [
      ...chat.messages,
      {
        content: input.trim(),
        role: "user",
        name: session.data?.user.name ?? "user",
      } as const,
    ];

    // Send the message thread to openai for a response
    void streamChatResponse(msgs);

    // Optimistically update the UI by adding the input message to the chat state
    setChat((prev) => {
      if (!prev) {
        return prev;
      }

      const currentMessage: Message = {
        id: "temp_user_message_id",
        content: input,
        role: "user",
        name: session.data.user.name ?? "user",
        chatId: chatId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return {
        ...prev,
        messages: [...prev.messages, currentMessage],
      };
    });

    // Clear the input
    setInput("");
  };

  if (!session) {
    return null;
  }

  if (isChatError) {
    return <div>error loading messages</div>;
  }

  if (!chat || isChatLoading) {
    return <div className="loading btn-ghost btn p-5" />;
  }

  return (
    <>
      <Head>
        <title>{chat.name}</title>
      </Head>

      <div className="flex max-h-screen w-full flex-col p-5">
        <div className="flex items-center gap-3">
          <Link href={"/"} className="btn-ghost btn gap-2 border-base-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
              />
            </svg>
            Home
          </Link>
          <h1 className="text-xl font-bold">{chat.name}</h1>
        </div>

        <div className="mt-2 flex grow flex-col gap-2 overflow-y-scroll">
          {chat.messages.map((message) => (
            <div className="rounded-lg bg-gray-50 p-4" key={message.id}>
              <p className="font-bold">
                {message.name} ({message.role})
              </p>
              <span className="prose">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </span>
            </div>
          ))}
        </div>

        <form
          className="form-control flex flex-row gap-4 pt-6"
          onSubmit={handleSubmit}
        >
          <textarea
            ref={chatInputRef}
            className="input textarea-bordered textarea w-full"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            // disabled={isStreamingChatResponse}
            onKeyDown={(e) => {
              // Submit the form when the user presses enter (without shift)
              if (e.key === "Enter" && !e.shiftKey) {
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />

          <button
            disabled={isStreamingChatResponse}
            className={`btn-outline ${
              isStreamingChatResponse ? "loading" : ""
            } btn`}
            type="submit"
          >
            send
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              if (!chatId) return;
              void deleteChat({ chatId });
            }}
            className="btn-error btn-square btn"
            disabled={isStreamingChatResponse}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatPage;
