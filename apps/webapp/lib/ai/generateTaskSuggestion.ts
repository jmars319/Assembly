import "server-only";
import { getOpenAI, type AssemblyAiClient } from "@/lib/ai/client";
import { buildInstructionBlock, type InstructionContext } from "@/lib/ai/instructions";

export type TaskSuggestion = {
  title: string;
  copyText: string;
  dueAt?: string;
};

export const generateTaskSuggestion = async (input: {
  promptText: string;
  projectName?: string;
  instructionContext?: InstructionContext;
  openai?: AssemblyAiClient;
}): Promise<TaskSuggestion> => {
  const promptText = input.promptText.trim();
  if (!promptText) {
    throw new Error("promptText is required.");
  }

  const instructionBlock = buildInstructionBlock(
    input.instructionContext ?? {
      context: ["Manual task suggestion"],
    },
  );

  const prompt =
    "You are drafting a manual task for a human review workflow.\n" +
    "Return JSON only with keys: title, copyText, dueAt (ISO, optional).\n" +
    "Keep title short and operational. Keep copyText concise instructions.\n" +
    "If suggesting dueAt, keep it within the next 7 days.\n\n" +
    `${instructionBlock.block}\n\n` +
    `Project: ${input.projectName ?? "Unknown"}\n` +
    `Prompt: ${promptText}\n\nJSON:`;

  const client = input.openai ?? getOpenAI();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: prompt,
  });

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("Empty response from AI.");
  }

  try {
    return JSON.parse(text) as TaskSuggestion;
  } catch {
    throw new Error("AI task output was not valid JSON.");
  }
};
