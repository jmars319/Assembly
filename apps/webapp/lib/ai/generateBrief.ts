import "server-only";
import { getOpenAI, type AssemblyAiClient } from "@/lib/ai/client";
import type { StylePreset } from "@/lib/content/stylePresets";
import { buildInstructionBlock, type InstructionContext } from "@/lib/ai/instructions";

type EvidenceItem = {
  type: string;
  title: string;
  body?: string | null;
  url?: string | null;
  occurredAt: string;
  content?: string | null;
};

const truncateText = (value: string, limit: number) =>
  value.length > limit ? `${value.slice(0, limit).trim()}...` : value;

export async function generateBrief(input: {
  repoFullName: string;
  items: EvidenceItem[];
  coverage?: {
    scope: "FULL" | "DAYS" | "COMMITS";
    scopeValue?: number | null;
    scopePage?: number | null;
    autoSelected?: boolean;
    fullCoverageComplete?: boolean;
  };
  stylePreset?: StylePreset;
  brandInstructions?: {
    tag?: string;
    tone?: string;
    hardRules?: string;
    doList?: string;
    dontList?: string;
  };
  instructionContext?: InstructionContext;
  openai?: AssemblyAiClient;
}): Promise<string> {
  if (!input.items.length) {
    throw new Error("No evidence items provided.");
  }

  const docsItems = input.items.filter((item) => item.type === "DOCUMENTATION").slice(0, 6);
  const otherItems = input.items.filter((item) => item.type !== "DOCUMENTATION").slice(0, 20);
  const items = [...docsItems, ...otherItems]
    .map((item) => {
      const lines = [
        `Type: ${item.type}`,
        `Title: ${item.title}`,
        item.body ? `Body: ${truncateText(item.body, 240)}` : null,
        item.url ? `URL: ${item.url}` : null,
        item.content ? `Content: ${truncateText(item.content, 600)}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  const instructionBlock = buildInstructionBlock(
    input.instructionContext ?? {
      style: input.stylePreset,
      org: input.brandInstructions,
      context: [`Repo: ${input.repoFullName}`],
    },
  );

  const coverage = input.coverage;
  const coverageLine = coverage
    ? `Evidence coverage: ${coverage.scope}${
        coverage.scope === "DAYS" && coverage.scopeValue
          ? ` (${coverage.scopeValue} days)`
          : coverage.scope === "COMMITS" && coverage.scopeValue
            ? ` (${coverage.scopeValue} commits, chunk ${coverage.scopePage ?? 0})`
            : ""
      }${coverage.autoSelected ? " (auto)" : ""}.`
    : "Evidence coverage: unknown.";
  const fullCoverageNote =
    coverage && coverage.fullCoverageComplete === false
      ? "Full history breakdown is not complete. Note this explicitly."
      : "Full history breakdown status: complete or not applicable.";
  const chunkNote =
    coverage?.scope === "COMMITS"
      ? "Commit chunks may represent a sampled window if history is large; say so if uncertain."
      : "Commit chunking not used.";

  const prompt =
    "You are a project assistant. Produce a concise, technical brief for human review.\n" +
    "Output plain text only. Avoid claims that cannot be supported by evidence.\n" +
    "Focus on what changed, why it matters, and constraints.\n" +
    "Use DOCUMENTATION items as baseline context before commit-level details.\n" +
    "If multiple notable features exist, call out each separately and suggest a multi-post plan.\n" +
    "If evidence seems thin for a complete brief, say so and suggest moving to the next chunk.\n" +
    "Include a question asking which repo should be next for scheduling.\n\n" +
    `${instructionBlock.block}\n\n` +
    `Repo: ${input.repoFullName}\n` +
    `${coverageLine}\n` +
    `${fullCoverageNote}\n` +
    `${chunkNote}\n` +
    "Evidence:\n" +
    items +
    "\n\nBrief:";

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
