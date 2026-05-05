import "server-only";
import { getOpenAI, type AssemblyAiClient } from "@/lib/ai/client";
import { buildInstructionBlock, type InstructionContext } from "@/lib/ai/instructions";

export type ScheduleSuggestion = {
  scheduledFor: string;
  channel: string;
  rationale: string;
  assumptions: string;
};

export const generateScheduleProposal = async (input: {
  postText: string;
  platform: string;
  instructionContext?: InstructionContext;
  openai?: AssemblyAiClient;
}): Promise<ScheduleSuggestion> => {
  const postText = input.postText.trim();
  if (!postText) {
    throw new Error("postText is required.");
  }

  const instructionBlock = buildInstructionBlock(
    input.instructionContext ?? {
      context: [`Platform: ${input.platform}`],
    },
  );

  const prompt =
    "You are a scheduling assistant for a human review workflow.\n" +
    "Return JSON only. Keys: scheduledFor (ISO), channel, rationale, assumptions.\n" +
    "Choose a time within the next 7 days during business hours (09:00–17:00 local).\n" +
    "Keep rationale short and grounded in cadence or platform norms.\n\n" +
    `${instructionBlock.block}\n\n` +
    `Platform: ${input.platform}\n` +
    `Post:\n${postText}\n\nJSON:`;

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
    return JSON.parse(text) as ScheduleSuggestion;
  } catch {
    throw new Error("AI schedule output was not valid JSON.");
  }
};
