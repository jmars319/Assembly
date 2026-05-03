import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { SignJWT, importPKCS8 } from "jose";
import { createPrivateKey } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const envLocalPath = path.join(repoRoot, ".env.local");

if (existsSync(envPath)) {
  config({ path: envPath });
}
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

const required = [
  "GITHUB_APP_ID",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_PRIVATE_KEY_PEM",
  "GITHUB_APP_SLUG",
];

const missing = required.filter((key) => !(process.env[key] ?? "").trim());

if (process.env.STORAGE_MODE !== "db") {
  console.log("github-smoke: SKIP (STORAGE_MODE != db)");
  process.exit(0);
}

if (missing.length) {
  console.log(`github-smoke: SKIP (missing env: ${missing.join(", ")})`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.log("github-smoke: SKIP (DATABASE_URL missing)");
  process.exit(0);
}

const normalizePem = (value = "") => value.replace(/\\n/g, "\n").replace(/^"|"$/g, "");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const installation = await prisma.gitHubInstallation.findFirst({
    where: { workspaceId: "workspace_default" },
    orderBy: { createdAt: "desc" },
  });

  if (!installation) {
    console.log("github-smoke: SKIP (no installation)");
  } else {
    const appId = process.env.GITHUB_APP_ID;
    const pem = normalizePem(process.env.GITHUB_PRIVATE_KEY_PEM);
    const pkcs8Pem = pem.includes("BEGIN RSA PRIVATE KEY")
      ? createPrivateKey(pem).export({ type: "pkcs8", format: "pem" }).toString()
      : pem;
    const privateKey = await importPKCS8(pkcs8Pem, "RS256");
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .setIssuer(appId)
      .sign(privateKey);

    const res = await fetch(
      `https://api.github.com/app/installations/${installation.installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "tenra Assembly",
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`github-smoke: FAILED (${res.status}) ${text}`);
      process.exitCode = 1;
    } else {
      const data = await res.json();
      if (!data.token) {
        console.error("github-smoke: FAILED (missing token)");
        process.exitCode = 1;
      } else {
        console.log("github-smoke: OK");
      }
    }
  }
} catch (err) {
  console.error("github-smoke: FAILED", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
