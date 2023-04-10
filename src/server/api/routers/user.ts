import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  getApiKey: protectedProcedure.query(async ({ ctx }) => {
    const apiKey = await ctx.prisma.user.findUniqueOrThrow({
      where: {
        id: ctx.session.user.id,
      },
      select: {
        apiKey: true,
      },
    });

    return apiKey.apiKey;
  }),
  createApiKey: protectedProcedure
    .input(
      z.object({
        apiKey: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: {
          apiKey: input.apiKey,
        },
      });
    }),
});
