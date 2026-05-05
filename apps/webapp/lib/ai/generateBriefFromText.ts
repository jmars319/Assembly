import "server-only";
import { getOpenAI, type AssemblyAiClient } from "@/lib/ai/client";
import type { StylePreset } from "@/lib/content/stylePresets";
import { buildInstructionBlock, type InstructionContext } from "@/lib/ai/instructions";

export async function generateBriefFromText(input: {
  promptText: string;
  stylePreset?: StylePreset;
  instructionContext?: InstructionContext;
  openai?: AssemblyAiClient;
}): Promise<string> {
  const promptText = input.promptText.trim();
  if (!promptText) {
    throw new Error("promptText is required.");
  }

  const instructionBlock = buildInstructionBlock(
    input.instructionContext ?? {
      style: input.stylePreset,
      context: ["General brief request"],
    },
  );

  const prompt =
    "You are a project assistant. Produce a concise, general brief for human review.\n" +
    "Output plain text only. Avoid claims that cannot be supported.\n" +
    "Focus on what changed/learned, why it matters, and constraints.\n" +
    "If the prompt is broad, propose 3-5 concrete angles.\n\n" +
    `${instructionBlock.block}\n\n` +
    `Prompt:\n${promptText}\n\nBrief:`;

  const client = input.openai ?? getOpenAI();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: prompt,
  });

  const text = (response.output_text ?? "").trim();
  if (!text) {
    throw new Error("Empty response from AI.");
  }
  return text;
}
