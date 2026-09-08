export interface ParsedGitHubTarget {
  type: "user" | "repo";
  rawInput: string;
  cleanInput: string;
  owner: string;
  repo?: string;
  fullName: string;
  subPath?: string;
  url: string;
}

/**
 * Parses user input into a structured GitHub target (User or Repository).
 * Handles:
 * - https://github.com/rome777/aiffel_test/blob/main/SPEC.md -> repo (owner: rome777, repo: aiffel_test, subPath: SPEC.md)
 * - https://github.com/rome777/aiffel_test -> repo
 * - rome777/aiffel_test -> repo
 * - https://github.com/torvalds -> user (owner: torvalds)
 * - @torvalds / torvalds -> user
 */
export function parseGitHubTarget(input: string): ParsedGitHubTarget {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("GitHub 사용자명 또는 리포지토리 URL을 입력해 주세요.");
  }

  // Remove protocol and trailing slashes
  let cleaned = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");

  // Strip query parameters and hashes
  cleaned = cleaned.split("?")[0].split("#")[0];

  const parts = cleaned.split("/").filter(Boolean);

  if (parts.length === 0) {
    throw new Error("올바른 GitHub 사용자명 또는 리포지토리 주소를 입력해 주세요.");
  }

  // Single token -> User target
  if (parts.length === 1) {
    const username = parts[0];
    return {
      type: "user",
      rawInput: input,
      cleanInput: username,
      owner: username,
      fullName: username,
      url: `https://github.com/${username}`,
    };
  }

  // Two or more tokens -> Repository target
  const owner = parts[0];
  const repo = parts[1];
  const fullName = `${owner}/${repo}`;

  let subPath: string | undefined = undefined;
  // If input format is owner/repo/blob/branch/filePath or owner/repo/tree/branch/subPath
  if (parts.length > 2) {
    if (parts[2] === "blob" || parts[2] === "tree") {
      // parts[3] is branch (e.g. 'main', 'master')
      if (parts.length > 4) {
        subPath = parts.slice(4).join("/");
      } else if (parts.length === 4) {
        // e.g. blob/main without file
        subPath = undefined;
      }
    } else {
      subPath = parts.slice(2).join("/");
    }
  }

  return {
    type: "repo",
    rawInput: input,
    cleanInput: fullName,
    owner,
    repo,
    fullName,
    subPath,
    url: `https://github.com/${fullName}`,
  };
}
