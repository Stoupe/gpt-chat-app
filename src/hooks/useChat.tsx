import { useRouter } from "next/router";
import { useState } from "react";
import { api } from "~/utils/api";

export const useChat = (chatId: string) => {
  const { replace } = useRouter();
  const utils = api.useContext();

  const [chat, setChat] = useState<typeof _chat>();

  const {
    data: _chat,
    isLoading: isChatLoading,
    isError: isChatError,
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
    setChat,
    isChatLoading,
    isChatError,

    deleteChat,
    /**
     * Note: this will invalidate the chat.get query, which will refetch the chat
     */
    createMultipleMessages,
  };
};
