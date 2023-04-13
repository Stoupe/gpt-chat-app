import { type Message } from "@prisma/client";
import { type inferRouterOutputs } from "@trpc/server";
import { create } from "zustand";
import { type chatRouter } from "~/server/api/routers/chat";

type Chat = inferRouterOutputs<typeof chatRouter>["get"];
type ChatState = {
  chats: Chat[];
  addChat: (chat: Chat) => void;
  addMessage: (message: Message) => void;
  editMessage: (message: Message) => void;
  editMessageContent: (messageId: string, messageContent: string) => void;
};

export const useChatStore = create<ChatState>()((set) => ({
  chats: [],
  addChat: (chat: Chat) => set((state) => ({ chats: [...state.chats, chat] })),
  addMessage: (message: Message) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === message.chatId
          ? {
              ...chat,
              messages: [...chat.messages, message],
            }
          : chat
      ),
    })),
  editMessage: (message: Message) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === message.chatId
          ? {
              ...chat,
              messages: chat.messages.map((m) =>
                m.id === message.id ? message : m
              ),
            }
          : chat
      ),
    })),
  editMessageContent: (messageId: string, messageContent: string) =>
    set((state) => ({
      chats: state.chats.map((chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: messageContent,
              }
            : message
        ),
      })),
    })),
}));