import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { createPrivateKey } from "crypto";

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required GitHub env var: ${key}`);
  }
  return value;
};

const getPrivateKey = async () => {
  const raw = requireEnv("GITHUB_PRIVATE_KEY_PEM");
  const normalized = raw.replace(/\\n/g, "\n").replace(/^"|"$/g, "").trim();
  if (!normalized) {
    throw new Error("GITHUB_PRIVATE_KEY_PEM is empty after normalization.");
  }
  if (normalized.includes("BEGIN RSA PRIVATE KEY")) {
    const pkcs8 = createPrivateKey({ key: normalized, format: "pem" }).export({
      format: "pem",
      type: "pkcs8",
    }) as string;
    return importPKCS8(pkcs8, "RS256");
  }
  return importPKCS8(normalized, "RS256");
};

export const createAppJwt = async () => {
  const appId = requireEnv("GITHUB_APP_ID");
  const privateKey = await getPrivateKey();

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .setIssuer(appId)
    .sign(privateKey);
};

export const githubAppFetch = async (path: string, init?: RequestInit) => {
  const jwt = await createAppJwt();
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tenra Assembly",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }
  return res;
};

export const getInstallationToken = async (installationId: number) => {
  const res = await githubAppFetch(`/app/installations/${installationId}/access_tokens`, {
    method: "POST",
  });
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Missing installation token in GitHub response.");
  }
  return data.token;
};

export const githubApiFetch = async (
  installationId: number,
  path: string,
  init?: RequestInit
) => {
  const token = await getInstallationToken(installationId);
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tenra Assembly",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }
  return res;
};
