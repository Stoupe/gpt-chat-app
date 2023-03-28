import randomWords from "random-words";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { prisma } from "~/server/db";

export const chatRouter = createTRPCRouter({
  get: protectedProcedure
    .input(
      z.object({
        chatId: z.string().cuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.findUniqueOrThrow({
        where: {
          id_userId: {
            id: input.chatId,
            userId: ctx.session.user.id,
          },
        },
        select: {
          id: true,
          userId: true,
          messages: {
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      return chat;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const chats = await ctx.prisma.chat.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return chats;
  }),

  /**
   * Create a new empty chat for the user, named 'New Chat'
   */
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const createdChat = prisma.chat.create({
      data: {
        name: randomWords(3).join("-"),
        user: {
          connect: {
            id: ctx.session.user.id,
          },
        },
      },
    });
    return createdChat;
  }),

  delete: protectedProcedure
    .input(
      z.object({
        chatId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const deletedChat = await ctx.prisma.chat.delete({
        where: {
          id_userId: {
            id: input.chatId,
            userId: ctx.session.user.id,
          },
        },
      });

      return deletedChat;
    }),
});
