import { type Role } from "@prisma/client";
import { observable } from "@trpc/server/observable";
import dayjs from "dayjs";
import EventEmitter from "events";
import {
  ChatCompletionRequestMessageRoleEnum,
  type CreateChatCompletionRequest,
  type CreateChatCompletionResponse,
} from "openai";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { OpenAIStream } from "~/utils/openAIStream";
// import { OpenAIStream, OpenAIStreamPayload } from "~/utils/openAIStream";

const asOpenAIRole = (role: Role): ChatCompletionRequestMessageRoleEnum => {
  switch (role) {
    case "USER":
      return ChatCompletionRequestMessageRoleEnum.User;
    case "SYSTEM":
      return ChatCompletionRequestMessageRoleEnum.System;
    case "ASSISTANT":
      return ChatCompletionRequestMessageRoleEnum.Assistant;
  }
};

const ee = new EventEmitter();

export const openAIRouter = createTRPCRouter({
  /**
   * Create a new message in a specific chat for the user
   */
  createChatCompletion: protectedProcedure
    .input(
      z.object({
        chatId: z.string().cuid(),
        message: z.string().trim().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = dayjs();
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
          messages: true,
        },
      });

      const formattedMessages = chat.messages.map((message) => {
        return {
          role: asOpenAIRole(message.role),
          content: message.content.trim(),
          name: ctx.session.user.name ?? "User",
        };
      });

      // TODO: calculate how many tokens the messages take up - this determines how many tokens the response can take up.
      // TODO: we will need to cut down the history if it's too long

      console.log("Awaiting response from openai");
      try {
        // TODO: This request can take a while, especially with GPT-4. Vercel serverless functions have a 10 second timeout.\
        // TODO: We need to figure out how to handle this. Maybe we can use a queue to process the requests in the background.
        // const response = await ctx.openai.createChatCompletion(
        //   {
        //     messages: [
        //       ...formattedMessages,
        //       {
        //         content: input.message,
        //         role: ChatCompletionRequestMessageRoleEnum.User,
        //         name: ctx.session.user.name ?? "User",
        //       },
        //     ],
        //     // model: "gpt-3.5-turbo",
        //     model: "gpt-4",
        //     max_tokens: 1000,
        //     temperature: 0.8,
        //     user: ctx.session.user.id,
        //     stream: false,
        //   }
        //   // { responseType: "stream" }
        // );

        const payload: CreateChatCompletionRequest = {
          model: "gpt-4",
          messages: [
            ...formattedMessages,
            {
              content: input.message,
              role: ChatCompletionRequestMessageRoleEnum.User,
              name: ctx.session.user.name ?? "User",
            },
          ],
          user: ctx.session.user.id,
          max_tokens: 1000,
          temperature: 0.8,
          stream: true,
          n: 1,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
          top_p: 1,
        };

        console.log("awaiting stream");
        const stream = await OpenAIStream(payload);
        console.log("stream created, returning response");
        console.log(
          "time taken:",
          dayjs().diff(startTime, "second"),
          "seconds"
        );
        return new Response(stream);

        // response.data
        // console.log(response.data);

        //Validate response
        // const responseMessage = response.data.choices[0]?.message;
        // if (!responseMessage) {
        //   console.error("No response from OpenAI", {
        //     statusText: response.statusText,
        //     status: response.status,
        //   });
        //   throw new Error("No response from OpenAI");
        // }

        // console.log("saving messages in db");
        // const createdMessage = await prisma.message.createMany({
        //   data: [
        //     {
        //       content: input.message,
        //       role: "USER",
        //       chatId: chat.id,
        //     },
        //     {
        //       content: responseMessage.content,
        //       role: "ASSISTANT",
        //       chatId: chat.id,
        //     },
        //   ],
        // });
        // return createdMessage;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Error from OpenAI", {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          error: error.response.data.error,
        });
        throw new Error("Error from OpenAI");
      }
    }),

  onCreate: protectedProcedure.subscription(() => {
    // return an `observable` with a callback which is triggered immediately
    return observable<CreateChatCompletionResponse>((emit) => {
      const onCreate = (data: CreateChatCompletionResponse) => {
        emit.next(data);
      };

      // trigger `onThing()` when `thing` is triggered in our event emitter
      ee.on("create", onCreate);

      // unsubscibe function when client disconnects or stops subscribing
      return () => {
        ee.off("create", onCreate);
      };
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        chatId: z.string().cuid(),
        message: z.string().trim().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // const startTime = dayjs();
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
          messages: true,
        },
      });

      const formattedMessages = chat.messages.map((message) => {
        return {
          role: asOpenAIRole(message.role),
          content: message.content.trim(),
          name: ctx.session.user.name ?? "User",
        };
      });

      console.log("Awaiting response from openai");
      const response = await ctx.openai.createChatCompletion(
        {
          messages: [
            ...formattedMessages,
            {
              content: input.message,
              role: ChatCompletionRequestMessageRoleEnum.User,
              name: ctx.session.user.name ?? "User",
            },
          ],
          // model: "gpt-3.5-turbo",
          model: "gpt-4",
          max_tokens: 1000,
          temperature: 0.8,
          user: ctx.session.user.id,
          stream: true,
        },
        {
          onDownloadProgress: (progressEvent) => {
            console.log(progressEvent);
          },
        }
      );
      console.log("response received");

      ee.emit("create", response);
    }),
});
