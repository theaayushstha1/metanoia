import { describe, expect, it, vi } from "vitest";
import { contextPrompt, enrichProfileContext, parseGitHubRepositoryUrl } from "@/lib/profile/context";

describe("profile context import", () => {
  it("accepts only direct public GitHub repository URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme/payments")).toEqual({ owner: "acme", repo: "payments" });
    expect(parseGitHubRepositoryUrl("https://github.com/acme/payments.git")).toEqual({ owner: "acme", repo: "payments" });
    expect(parseGitHubRepositoryUrl("https://example.com/acme/payments")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://github.com/acme/payments/issues")).toBeNull();
  });

  it("imports bounded repository metadata and labels it as untrusted", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          html_url: "https://github.com/acme/payments",
          full_name: "acme/payments",
          description: "A checkout service",
          language: "TypeScript",
          topics: ["payments", "nextjs"],
          stargazers_count: 12,
        }),
        { status: 200 }
      )
    );
    const context = await enrichProfileContext(
      { projectSummary: "Building an API marketplace", githubRepos: ["https://github.com/acme/payments"] },
      fetcher as typeof fetch
    );
    expect(context.repositories[0]).toMatchObject({ imported: true, language: "TypeScript" });
    expect(contextPrompt(context)).toContain("untrusted_project_context");
    expect(contextPrompt(context)).toContain("topics=payments,nextjs");
  });
});
