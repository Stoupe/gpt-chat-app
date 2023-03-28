import { createTRPCRouter } from "~/server/api/trpc";
import { chatRouter } from "~/server/api/routers/chat";
import { messageRouter } from "./routers/message";
import { openAIRouter } from "./routers/openai";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  chat: chatRouter,
  message: messageRouter,
  openai: openAIRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
