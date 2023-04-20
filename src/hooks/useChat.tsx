import { useRouter } from "next/router";
import { api } from "~/utils/api";

export const useChat = (chatId: string) => {
  const { replace } = useRouter();
  const utils = api.useContext();

  const {
    data: chat,
    isLoading,
    isError,
  } = api.chat.get.useQuery(
    { chatId },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { mutate: updateSystemMessage } =
    api.message.updateSystemMessage.useMutation({
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

  const { mutate: createMultipleMessages } =
    api.message.createMultiple.useMutation({
      onSuccess: () => {
        void utils.chat.get.invalidate({ chatId });
      },
    });

  return {
    chat,
    isLoading,
    isError,
    /**
     * Note: this will invalidate the chat.getAll query, which will refetch all chats for the sidebar
     */
    deleteChat,
    /**
     * Note: this will invalidate the chat.get query, which will refetch the chat
     */
    updateSystemMessage,
    /**
     * Note: this will invalidate the chat.get query, which will refetch the chat
     */
    createMultipleMessages,
  };
};
