import { parseRegistryAssemblyDocumentRequest } from "@assembly/shared-types/handoffs";
import type { ProjectNoteRow } from "@/lib/content/types";

export function registryDocumentRequestToProjectNote(input: unknown): {
  title: string;
  rawInput: string;
  structured: ProjectNoteRow;
  summary: string;
} {
  const request = parseRegistryAssemblyDocumentRequest(input);
  const date = request.exportedAt.slice(0, 10);
  const structured: ProjectNoteRow = {
    caseStudySlug: `registry-${request.organizationId}`,
    date,
    metric: request.title,
    detail: `${request.desiredOutput} requested for ${request.documentType}. Customer ${request.customerId}${
      request.assignmentId ? `, assignment ${request.assignmentId}` : ""
    }.`,
    sourceLink: null
  };

  return {
    title: request.title,
    summary: structured.detail,
    structured,
    rawInput: [
      `# ${request.title}`,
      "",
      `Source schema: ${request.schema}`,
      `Desired output: ${request.desiredOutput}`,
      `Document type: ${request.documentType}`,
      `Customer: ${request.customerId}`,
      request.assignmentId ? `Assignment: ${request.assignmentId}` : "",
      "",
      request.contextMarkdown
    ]
      .filter(Boolean)
      .join("\n")
  };
}
