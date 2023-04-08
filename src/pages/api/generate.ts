import {
  ChatCompletionRequestMessageRoleEnum,
  type ChatCompletionRequestMessage,
  type CreateChatCompletionRequest,
} from "openai";
import { z } from "zod";
import { OpenAIStream } from "~/utils/openAIStream";

export const config = {
  runtime: "edge",
};

const handler = async (req: Request): Promise<Response> => {
  const messagesSchema: z.ZodType<ChatCompletionRequestMessage[]> = z.array(
    z.object({
      role: z.nativeEnum(ChatCompletionRequestMessageRoleEnum),
      content: z.string().min(1).max(1000),
      name: z.string().min(1).max(100).optional(),
    })
  );

  const messages = messagesSchema.parse(await req.json());

  const payload: CreateChatCompletionRequest = {
    model: "gpt-4",
    messages,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 1000,
    stream: true,
    n: 1,
  };

  console.log("awaiting stream");

  const stream = await OpenAIStream(payload);
  return new Response(stream);
};

export default handler;
