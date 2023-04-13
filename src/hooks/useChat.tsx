import { useRouter } from "next/router";
import { useChatStore } from "~/store/store";
import { api } from "~/utils/api";

export const useFetchChat = (chatId: string) => {
  // Zustand state
  const chat = useChatStore((c) => c.chats.find((c) => c.id === chatId));
  const addChat = useChatStore((c) => c.addChat);
  const addMessage = useChatStore((c) => c.addMessage);
  const editMessage = useChatStore((c) => c.editMessage);
  const editMessageContent = useChatStore((c) => c.editMessageContent);

  const { isLoading, isError } = api.chat.get.useQuery(
    { chatId },
    {
      onSuccess: (data) => {
        addChat(data);
      },
      refetchOnWindowFocus: false,
    }
  );

  return {
    chat,
    isLoading,
    isError,
    addMessage,
    editMessage,
    editMessageContent,
  };
};

export const useChat = (chatId: string) => {
  const { replace } = useRouter();
  const utils = api.useContext();

  const { mutate: deleteChat } = api.chat.delete.useMutation({
    onSettled: async () => {
      await replace("/");
      void utils.chat.getAll.invalidate();
    },
  });

  const { mutate: createMultipleMessages } =
    api.message.createMultiple.useMutation({
      onSuccess: () => {
        void utils.chat.get.invalidate({ chatId });
      },
    });

  return {
    deleteChat,
    /**
     * Note: this will invalidate the chat.get query, which will refetch the chat
     */
    createMultipleMessages,
  };
};
