import {
  ChatCompletionRequestMessageRoleEnum,
  type ChatCompletionRequestMessage,
  type CreateChatCompletionRequest,
} from "openai";
import { z } from "zod";
import { OpenAIStream } from "~/utils/openAIStream";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  const reqSchema: z.ZodType<{
    model: "gpt-3.5-turbo" | "gpt-4";
    messages: ChatCompletionRequestMessage[];
  }> = z.object({
    model: z.enum(["gpt-3.5-turbo", "gpt-4"]),
    messages: z.array(
      z.object({
        role: z.nativeEnum(ChatCompletionRequestMessageRoleEnum),
        content: z.string().min(1),
        name: z.string().min(1).max(100).optional(),
      })
    ),
  });

  const data = reqSchema.parse(await req.json());

  const plaintextApiKey = req.headers.get("X-OPENAI-API-KEY");

  if (!plaintextApiKey) {
    return new Response("Missing X-OPENAI-API-KEY header", {
      status: 400,
    });
  }

  const payload: CreateChatCompletionRequest = {
    model: data.model,
    messages: data.messages,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: data.model === "gpt-4" ? 4000 : 1000,
    stream: true,
    n: 1,
  };

  console.log("awaiting stream");

  const stream = await OpenAIStream(payload, plaintextApiKey);
  return new Response(stream);
}
