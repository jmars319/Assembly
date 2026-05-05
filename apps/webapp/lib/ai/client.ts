import "server-only";
import OpenAI from "openai";
import { getPrismaClient } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/workspace/apiKey";

export interface AssemblyAiResponse {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}

export interface AssemblyAiClient {
  responses: {
    create(input: {
      model: string;
      input: unknown;
      text?: unknown;
      metadata?: unknown;
    }): Promise<AssemblyAiResponse>;
  };
}

type LocalProviderMode = "ollama" | "openai-compatible" | "off";

let cached: AssemblyAiClient | null = null;
const clientByKey = new Map<string, AssemblyAiClient>();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveLocalProviderMode = (
  source: Record<string, string | undefined> = process.env,
): LocalProviderMode => {
  const explicit = source.ASSEMBLY_LOCAL_AI_PROVIDER?.trim().toLowerCase();

  if (explicit === "ollama" || explicit === "openai-compatible" || explicit === "off") {
    return explicit;
  }

  if (source.ASSEMBLY_LOCAL_AI_BASE_URL?.trim() || source.OLLAMA_HOST?.trim()) {
    return "ollama";
  }

  return "off";
};

const resolveLocalBaseUrl = (source: Record<string, string | undefined> = process.env) => {
  const raw = source.ASSEMBLY_LOCAL_AI_BASE_URL?.trim() || source.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
  return trimTrailingSlash(raw);
};

const resolveLocalModel = (_requestedModel: string, source: Record<string, string | undefined> = process.env) =>
  source.ASSEMBLY_LOCAL_AI_MODEL?.trim() || "llama3.2";

const flattenResponsesInput = (input: unknown): string => {
  if (typeof input === "string") {
    return input;
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
        const role = "role" in item && typeof item.role === "string" ? `${item.role}: ` : "";
        const content = "content" in item ? item.content : undefined;
        if (typeof content === "string") return `${role}${content}`;
        if (Array.isArray(content)) {
          const text = content
            .map((part) => {
              if (typeof part === "string") return part;
              if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
                return part.text;
              }
              return "";
            })
            .filter(Boolean)
            .join("\n");
          return `${role}${text}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return JSON.stringify(input);
};

class OllamaResponsesClient implements AssemblyAiClient {
  readonly #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  responses = {
    create: async (input: { model: string; input: unknown; text?: unknown }): Promise<AssemblyAiResponse> => {
      const prompt = flattenResponsesInput(input.input);
      const response = await fetch(`${this.#baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: resolveLocalModel(input.model),
          prompt,
          stream: false,
          ...(JSON.stringify(input.text ?? "").includes("json_object") ? { format: "json" } : {}),
        }),
        signal: AbortSignal.timeout(120_000),
      });

      const payload = await response.json().catch(() => null) as { response?: unknown; error?: unknown } | null;

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : `Local Ollama request failed with HTTP ${response.status}.`;
        throw new Error(message);
      }

      if (typeof payload?.response !== "string") {
        throw new Error("Local Ollama response did not include text.");
      }

      return { output_text: payload.response.trim() };
    },
  };
}

export const hasAssemblyAiProvider = (workspaceKeyConfigured = false): boolean => {
  return Boolean(process.env.OPENAI_API_KEY?.trim()) ||
    Boolean(process.env.OPENAI_BASE_URL?.trim()) ||
    resolveLocalProviderMode() !== "off" ||
    workspaceKeyConfigured;
};

class OpenAIResponsesClient implements AssemblyAiClient {
  readonly #client: OpenAI;

  constructor(options: ConstructorParameters<typeof OpenAI>[0]) {
    this.#client = new OpenAI(options);
  }

  responses = {
    create: async (input: {
      model: string;
      input: unknown;
      text?: unknown;
      metadata?: unknown;
    }): Promise<AssemblyAiResponse> => {
      const response = await this.#client.responses.create(input as Parameters<OpenAI["responses"]["create"]>[0]);
      return response as AssemblyAiResponse;
    },
  };
}

export const getOpenAI = (): AssemblyAiClient => {
  if (cached) return cached;

  const localProviderMode = resolveLocalProviderMode();
  if (localProviderMode === "ollama") {
    cached = new OllamaResponsesClient(resolveLocalBaseUrl());
    return cached;
  }

  const baseURL =
    localProviderMode === "openai-compatible"
      ? resolveLocalBaseUrl()
      : process.env.OPENAI_BASE_URL?.trim() || undefined;
  const apiKey = process.env.OPENAI_API_KEY?.trim() || (baseURL ? "local" : "");
  if (!apiKey) {
    throw new Error("An AI provider is required. Set OPENAI_API_KEY, OPENAI_BASE_URL, or ASSEMBLY_LOCAL_AI_BASE_URL.");
  }

  const client = new OpenAIResponsesClient({
    apiKey,
    baseURL,
  });
  cached = client;
  return cached;
};

export const getOpenAIClient = (apiKey?: string): AssemblyAiClient => {
  if (!apiKey) return getOpenAI();
  const cachedClient = clientByKey.get(apiKey);
  if (cachedClient) return cachedClient;
  const client = new OpenAIResponsesClient({ apiKey });
  clientByKey.set(apiKey, client);
  return client;
};

export const getOpenAIForWorkspace = async (workspaceId: string): Promise<AssemblyAiClient> => {
  const prisma = getPrismaClient();
  const record = await prisma.workspaceApiKey.findUnique({ where: { workspaceId } });
  if (!record?.apiKeyCipher) {
    return getOpenAI();
  }
  const apiKey = decryptApiKey(record.apiKeyCipher);
  return getOpenAIClient(apiKey);
};
