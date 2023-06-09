import { ChatCompletionRequestMessageRoleEnum } from "openai";
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
          role: z.nativeEnum(ChatCompletionRequestMessageRoleEnum),
          name: z.string().min(1).max(100),
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
          name: input.message.name,
        },
      });
    }),

  /**
   * Note: if message passed is null or an empty string, the system message will be deleted
   */
  updateSystemMessage: protectedProcedure
    .input(
      z.object({
        chatId: z.string().cuid(),
        message: z
          .string()
          .nullable()
          .transform((v) => (v === "" ? null : v)),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.update({
        where: {
          id_userId: {
            id: input.chatId,
            userId: ctx.session.user.id,
          },
        },
        data: {
          // Note: null = delete, undefined = do nothing
          systemMessage: input.message,
        },
      });
      return chat;
    }),

  createMultiple: protectedProcedure
    .input(
      z.object({
        chatId: z.string().cuid(),
        messages: z
          .array(
            z.object({
              content: z.string().min(1),
              role: z.nativeEnum(ChatCompletionRequestMessageRoleEnum),
              name: z.string().min(1).max(100),
            })
          )
          .nonempty(),
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

      await prisma.message.createMany({
        data: input.messages.map((message) => ({
          content: message.content,
          role: message.role,
          chatId: chat.id,
          name: message.name,
        })),
      });
    }),
});
