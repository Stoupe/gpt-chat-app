import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { prisma } from "~/server/db";

export const messageRouter = createTRPCRouter({
  getAll: protectedProcedure
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
        include: {
          messages: true,
        },
      });

      if (!chat) {
        throw new Error("Chat not found");
      }

      return chat;
    }),

  /**
   * Create a new message in a specific chat for the user
   */
  create: protectedProcedure
    .input(
      z.object({
        chatId: z.string().cuid(),
        message: z.object({
          content: z.string().min(1),
          role: z.enum(["USER", "SYSTEM", "ASSISTANT"]),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
        },
      });

      await prisma.message.create({
        data: {
          content: input.message.content,
          role: input.message.role,
          chatId: chat.id,
        },
      });
    }),
});
