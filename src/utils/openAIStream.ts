/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// import {
//   createParser,
//   type ParsedEvent,
//   type ReconnectInterval,
// } from "eventsource-parser";
// import { type CreateChatCompletionRequest } from "openai";
// import { env } from "~/env.mjs";

// // export type ChatGPTAgent = "user" | "system" | "assistant";

// // export interface ChatGPTMessage {
// //   role: ChatGPTAgent;
// //   content: string;
// //   user?: string;
// // }

// export interface OpenAIStreamPayload {
//   model: string;
//   messages: CreateChatCompletionRequest["messages"];
//   temperature: number;
//   top_p: number;
//   frequency_penalty: number;
//   presence_penalty: number;
//   max_tokens: number;
//   stream: boolean;
//   n: number;
//   user?: string;
// }

// export async function OpenAIStream(payload: OpenAIStreamPayload) {
//   const encoder = new TextEncoder();
//   const decoder = new TextDecoder();

//   let counter = 0;

//   const res = await fetch("https://api.openai.com/v1/chat/completions", {
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}`,
//     },
//     method: "POST",
//     body: JSON.stringify(payload),
//   });

//   const stream = new ReadableStream({
//     async start(controller) {
//       // callback
//       function onParse(event: ParsedEvent | ReconnectInterval) {
//         // console.log("onParse", event);
//         if (event.type === "event") {
//           const data = event.data;
//           // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
//           if (data === "[DONE]") {
//             controller.close();
//             return;
//           }
//           try {
//             const json = JSON.parse(data);
//             const text = json.choices[0].delta?.content || "";
//             if (counter < 2 && (text.match(/\n/) || []).length) {
//               // this is a prefix character (i.e., "\n\n"), do nothing
//               return;
//             }
//             const queue = encoder.encode(text);
//             controller.enqueue(queue);
//             counter++;
//           } catch (e) {
//             // maybe parse error
//             controller.error(e);
//           }
//         }
//       }

//       // stream response (SSE) from OpenAI may be fragmented into multiple chunks
//       // this ensures we properly read chunks and invoke an event for each SSE event stream
//       const parser = createParser(onParse);
//       // https://web.dev/streams/#asynchronous-iteration
//       for await (const chunk of res.body as any) {
//         parser.feed(decoder.decode(chunk));
//       }
//     },
//   });

//   return stream;
// }

import {
  createParser,
  type ParsedEvent,
  type ReconnectInterval,
} from "eventsource-parser";
import { type CreateChatCompletionRequest } from "openai";
import { env } from "~/env.mjs";

export async function OpenAIStream(payload: CreateChatCompletionRequest) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let counter = 0;

  console.log("fetching stream in openAIStream.ts");
  // console.log("payload", payload);
  // console.log("key", env.OPENAI_API_KEY);

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
        console.log("onParse");
        if (event.type === "event") {
          const data = event.data;
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            console.log("JSON", json);
            const text = json.choices[0].delta?.content;
            console.log("TEXT", text);
            if (counter < 2 && (text?.match(/\n/) || []).length) {
              console.log("returning");
              return;
            }
            const queue = encoder.encode(text);
            controller.enqueue(queue);
            counter++;
          } catch (e) {
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
