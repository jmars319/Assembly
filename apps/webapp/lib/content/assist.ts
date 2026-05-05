import "server-only";
import { getOpenAI, type AssemblyAiClient } from "@/lib/ai/client";
import { buildInstructionBlock, type InstructionContext } from "@/lib/ai/instructions";
import type { ContentItem } from "@prisma/client";

type AssistMode = "sanitize" | "structure" | "summarize";

export const assistContentItem = async (
  item: ContentItem,
  mode: AssistMode,
  instructionContext?: InstructionContext,
  openai?: AssemblyAiClient,
) => {
  const instructionBlock = buildInstructionBlock(
    instructionContext ?? {
      context: [`Mode: ${mode}`, `Content type: ${item.type}`],
    },
  );
  const prompt = [
    "You are a content ops assistant. Clean up or structure the content without changing meaning.",
    instructionBlock.block,
    `Mode: ${mode}`,
    `Type: ${item.type}`,
    `Title: ${item.title ?? ""}`,
    `Summary: ${item.summary ?? ""}`,
    `Body: ${item.body ?? ""}`,
    `Raw input: ${item.rawInput ?? ""}`,
    "Return JSON with keys: title, summary, body, structured.",
  ].join("\n");

  const client = openai ?? getOpenAI();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: prompt,
  });

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("AI assist returned no output.");
  }

  let parsed: { title?: string; summary?: string; body?: string; structured?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI assist output was not valid JSON.");
  }

  return parsed;
};
