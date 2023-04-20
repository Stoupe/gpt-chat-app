import { useSession } from "next-auth/react";
import { type ChatCompletionRequestMessage } from "openai";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useChat } from "~/hooks/useChat";
import { ChatIcon, DeleteIcon, SettingsIcon } from "~/icons";
import { api } from "~/utils/api";

const ChatInputSection = ({
  chatId,
  setStreamedMessage,
}: {
  chatId: string;
  setStreamedMessage: Dispatch<SetStateAction<string>>;
}) => {
  const session = useSession();

  const { chat, deleteChat, createMultipleMessages } = useChat(chatId);

  const [input, setInput] = useState("");
  const [isStreamingChatResponse, setIsStreamingChatResponse] = useState(false);

  const [model, setModel] = useState<"gpt-3.5-turbo" | "gpt-4">(
    "gpt-3.5-turbo"
  );

  const { data: plaintextApiKey } = api.user.getApiKey.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  /**
   * Responsible for combining the given messages and the user's input into a conversation object,
   * formatted as a ChatCompletionRequestMessage[]. It then sends the conversation to our API endpoint
   * to generate a response from the OpenAI API, and handles parsing the streamed response and updating
   * the chat state.
   */
  const streamChatResponse = async (
    // The messages to send to the OpenAI API
    // We only care about the name, content and role of each message
    messages: ChatCompletionRequestMessage[],
    model: "gpt-3.5-turbo" | "gpt-4"
  ) => {
    setIsStreamingChatResponse(true);

    // Make the request to our API endpoint to generate a response from the OpenAI API
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OPENAI-API-KEY": plaintextApiKey ?? "",
      },
      body: JSON.stringify({ messages, model }),
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

      setStreamedMessage((streamedMessage) => streamedMessage + chunkValue);

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
          name: session.data?.user.name ?? "name unknown",
        },
        {
          content: assistantMsg,
          role: "assistant",
          name: `ChatGPT (${model})`,
        },
      ],
    });

    return assistantMsg;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chatId || !chat || !session.data || input.trim().length < 1) return;

    // Optimistically update the UI by adding the input message to the chat state
    chat.messages.push({
      id: "temp_user_message_id",
      content: input,
      role: "user",
      name: session.data.user.name ?? "name unknown",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Clear the input
    setInput("");

    /**
     * Here we combine the messages and the user's input into a conversation object
     *
     * - Previous messages come first
     * - Then add the user's input message
     * - Then add the system message last
     */
    const conversation: ChatCompletionRequestMessage[] = [
      ...chat.messages.map((msg) => ({
        content: msg.content,
        role: msg.role,
        name: msg.name,
      })),
    ];

    if (chat.systemMessage) {
      conversation.push({
        name: "system",
        role: "system",
        content: chat.systemMessage,
      });
    }

    // Send the message thread to openai for a response
    const responseMessage = await streamChatResponse(conversation, model);

    if (!responseMessage) {
      return;
    }

    // Optimistically update the UI by adding the response message to the chat state
    chat.messages.push({
      id: "temp_assistant_message_id",
      content: responseMessage,
      role: "assistant",
      name: `ChatGPT (${model})`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    setStreamedMessage("");
  };

  return (
    <form
      className="form-control flex flex-row items-center gap-2 pt-6"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <textarea
        // ref={chatInputRef} look into forwarding refs
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
        className={`btn ${isStreamingChatResponse ? "loading" : ""} btn px-6`}
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
            <div className="form-control active:bg-base-200 active:text-inherit">
              <label className="label flex w-full cursor-pointer justify-between">
                <span>GPT 3.5</span>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={model === "gpt-4"}
                  onChange={() =>
                    setModel((m) =>
                      m === "gpt-3.5-turbo" ? "gpt-4" : "gpt-3.5-turbo"
                    )
                  }
                />
                <span>GPT 4</span>
              </label>
            </div>
          </li>
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
  );
};

export default ChatInputSection;
