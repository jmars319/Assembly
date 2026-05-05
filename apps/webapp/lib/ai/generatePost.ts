import "server-only";
import { platformPromptInstructions } from "@assembly/prompts/post";
import { getOpenAI, type AssemblyAiClient } from "@/lib/ai/client";
import type { StylePreset } from "@/lib/content/stylePresets";
import { buildInstructionBlock, type InstructionContext } from "@/lib/ai/instructions";

type PostInput = {
  briefText: string;
  platform?:
    | "twitter"
    | "instagram"
    | "linkedin"
    | "facebook"
    | "gbp"
    | "youtube"
    | "threads"
    | "tiktok"
    | "mastodon"
    | "bluesky"
    | "reddit"
    | "pinterest"
    | "snapchat"
    | "generic";
  repoNames?: string[];
  evidenceItems?: {
    type: string;
    title: string;
    body?: string | null;
    content?: string | null;
  }[];
  brandInstructions?: {
    tag?: string;
    tone?: string;
    hardRules?: string;
    doList?: string;
    dontList?: string;
  };
  stylePreset?: StylePreset;
  instructionContext?: InstructionContext;
  openai?: AssemblyAiClient;
};

const truncateText = (value: string, limit: number) =>
  value.length > limit ? `${value.slice(0, limit).trim()}...` : value;

export async function generatePost(input: PostInput): Promise<string> {
  const briefText = input.briefText?.trim();
  if (!briefText) {
    throw new Error("briefText is required.");
  }

  const platform = input.platform ?? "generic";
  const repoLine = input.repoNames?.length
    ? `Repo context (names only): ${input.repoNames.join(", ")}`
    : "Repo context: none provided.";
  const evidenceBlock = input.evidenceItems?.length
    ? input.evidenceItems
        .slice(0, 30)
        .map((item) => {
          const lines = [
            `Type: ${item.type}`,
            `Title: ${item.title}`,
            item.body ? `Body: ${truncateText(item.body, 400)}` : null,
            item.content ? `Content: ${truncateText(item.content, 800)}` : null,
          ].filter(Boolean);
          return lines.join("\n");
        })
        .join("\n\n---\n\n")
    : "No evidence items provided.";
  const instructionBlock = buildInstructionBlock(
    input.instructionContext ?? {
      style: input.stylePreset,
      org: input.brandInstructions,
      context: [`Platform: ${platform}`],
    },
  );
  const prompt =
    "You are drafting a social media post for a human review workflow.\n" +
    "The output must be plain text only. No markdown, no JSON, no hashtags unless explicitly asked.\n" +
    "Avoid claims of automation or posting. Keep it factual and reviewable.\n\n" +
    `Platform guidance: ${platformPromptInstructions[platform]}\n\n` +
    `${instructionBlock.block}\n\n` +
    `${repoLine}\n` +
    "Use repo names only for context; do not assume repository contents.\n" +
    "Use evidence items to ground claims; do not invent details beyond evidence and the brief.\n\n" +
    "Evidence:\n" +
    `${evidenceBlock}\n\n` +
    `Brief:\n${briefText}\n\n` +
    "Post:";

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
