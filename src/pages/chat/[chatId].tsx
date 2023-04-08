import { type Message } from "@prisma/client";
import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  ChatCompletionRequestMessageRoleEnum,
  type ChatCompletionRequestMessage,
} from "openai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "~/utils/api";

const ChatPage: NextPage = () => {
  //Get chat id from url path (nextjs)
  const { query, replace } = useRouter();
  const chatId = query.chatId as string;

  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const utils = api.useContext();
  const session = useSession();

  const [input, setInput] = useState("");
  const [chat, setChat] = useState<typeof _chat>();

  const {
    data: _chat,
    isLoading: isLoadingMessages,
    isError,
  } = api.chat.get.useQuery(
    { chatId },
    {
      onSuccess: (data) => {
        setChat(data);
      },
      onError: () => {
        console.log("error loading chat. redirecting to /");
        void replace("/");
      },
      refetchOnWindowFocus: false,
    }
  );

  const { mutate: createMultipleMessages } =
    api.message.createMultiple.useMutation({
      onSuccess: () => {
        void utils.chat.get.invalidate({ chatId });
      },
    });

  const { mutate: deleteChat } = api.chat.delete.useMutation({
    onSettled: async () => {
      await replace("/");
      void utils.chat.getAll.invalidate();
    },
  });

  const [isStreamingChatResponse, setIsStreamingChatResponse] = useState(false);

  const generateChatResponse = async (
    messages: ChatCompletionRequestMessage[]
  ) => {
    setIsStreamingChatResponse(true);

    const messageHistory = messages;

    const body: ChatCompletionRequestMessage[] = [
      ...messageHistory,
      {
        role: "user",
        content: input.trim(),
        name: session.data?.user.name ?? "user",
      },
    ];

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
          // This should never happen as we check for the temp message above
          return prev;
        }

        return {
          ...prev,
          messages: [
            ...prev.messages.slice(0, tempMessageIndex),
            {
              ...tempMessage,
              content: `${tempMessage?.content ?? ""}${chunkValue}`,
              updatedAt: new Date(),
            },
            ...prev.messages.slice(tempMessageIndex + 1),
          ],
        };
      });

      // setChatResponse((prev) => prev + chunkValue);
      assistantMsg += chunkValue;
    }

    setIsStreamingChatResponse(false);

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

  useEffect(() => {
    if (!isStreamingChatResponse && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isStreamingChatResponse]);

  if (!session) {
    return null;
  }

  if (isError) {
    return <div>error loading messages</div>;
  }

  if (!chat || isLoadingMessages) {
    return <div className="loading btn-ghost btn p-5" />;
  }

  return (
    <>
      <Head>
        <title>Chat {chatId}</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex max-h-screen w-full flex-col p-5">
        <h1 className="text-xl font-bold">{chat.name}</h1>

        <div className="grow overflow-y-scroll">
          {chat.messages.map((message) => (
            <div className="m-2 rounded-lg bg-gray-50 p-4" key={message.id}>
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
          onSubmit={(e) => {
            e.preventDefault();
            if (!chatId) return;

            const messageHistory: ChatCompletionRequestMessage[] =
              chat?.messages.map((message) => ({
                role: message.role,
                content: message.content,
                name:
                  message.role === ChatCompletionRequestMessageRoleEnum.User
                    ? session.data?.user.name ?? "user"
                    : "assistant",
              })) ?? [];

            // Send the message thread to openai for a response
            void generateChatResponse(messageHistory);

            // Optimistically update the UI by adding the input message to the chat state
            setChat((prev) => {
              if (!prev) {
                return prev;
              }

              const currentMessage: Message = {
                id: "temp_user_message_id",
                content: input,
                role: "user",
                name: session.data?.user.name ?? "user",
                chatId: chatId,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              return { ...prev, messages: [...prev.messages, currentMessage] };
            });

            // Clear the input
            setInput("");
          }}
        >
          <textarea
            ref={chatInputRef}
            className="input textarea-bordered textarea w-full"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            disabled={isStreamingChatResponse}
            onKeyDown={(e) => {
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
            className="btn-error btn"
            disabled={isStreamingChatResponse}
          >
            Delete Chat
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatPage;
