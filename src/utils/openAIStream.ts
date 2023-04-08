/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  createParser,
  type ParsedEvent,
  type ReconnectInterval,
} from "eventsource-parser";
import { type CreateChatCompletionRequest } from "openai";
import { z } from "zod";
import { env } from "~/env.mjs";

export async function OpenAIStream(payload: CreateChatCompletionRequest) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let counter = 0;

  console.log("fetching stream in openAIStream.ts");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  console.log("Creating stream");

  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const schema = z.object({
              id: z.string(),
              object: z.string(),
              created: z.number().int(),
              model: z.string(),
              choices: z
                .array(
                  z.object({
                    delta: z.object({
                      content: z.string().optional(),
                      role: z.string().optional(),
                    }),
                    index: z.number().int(),
                    finish_reason: z.string().nullable(),
                  })
                )
                .nonempty(),
            });

            console.log("DATA,", data);
            const json = schema.parse(JSON.parse(data));

            const text = json.choices[0].delta.content;

            console.log("TEXT", text);

            if (counter < 2 && (text?.match(/\n/) || []).length) {
              console.log("returning");
              return;
            }

            const queue = encoder.encode(text);
            controller.enqueue(queue);
            counter++;
          } catch (e) {
            console.error(e);
            controller.error(e);
          }
        }
      }

      // stream response (SSE) from OpenAI may be fragmented into multiple chunks
      // this ensures we properly read chunks & invoke an event for each SSE event stream
      const parser = createParser(onParse);

      // https://web.dev/streams/#asynchronous-iteration
      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  console.log("returning stream");

  return stream;
}
