import {
  GitHubAggregatedData,
  GitHubUserProfile,
  GitHubRepoSummary,
  GitHubRepoDetailedData,
  GitHubCommitInfo,
} from "./types";
import { MOCK_GITHUB_USERS, MOCK_GITHUB_REPOS } from "./mockData";

export async function fetchGitHubData(target: string): Promise<GitHubAggregatedData> {
  const cleanTarget = target.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");

  if (!cleanTarget) {
    throw new Error("GitHub 사용자명 또는 리포지토리 이름을 입력해 주세요.");
  }

  // 1. Check if mock user requested
  const lowerTarget = cleanTarget.toLowerCase();
  if (MOCK_GITHUB_USERS[lowerTarget]) {
    return {
      ...MOCK_GITHUB_USERS[lowerTarget],
      analyzedAt: new Date().toISOString(),
    };
  }

  // 2. Prepare headers
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GitRoast-App",
  };

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken && !githubToken.includes("your-github")) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  try {
    // 3. Fetch user profile
    const userRes = await fetch(`https://api.github.com/users/${cleanTarget}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (userRes.status === 404) {
      throw new Error(`GitHub 사용자 '@${cleanTarget}'를 찾을 수 없습니다. 아이디를 다시 확인해 주세요.`);
    }

    if (userRes.status === 403 || userRes.status === 429) {
      // Rate limit hit - fallback to mock if possible or give polite message
      console.warn("GitHub API rate limit hit, using mock data fallback.");
      return {
        ...MOCK_GITHUB_USERS["rookie-dev"],
        user: {
          ...MOCK_GITHUB_USERS["rookie-dev"].user,
          login: cleanTarget,
          name: cleanTarget,
        },
        analyzedAt: new Date().toISOString(),
        isMock: true,
      };
    }

    if (!userRes.ok) {
      throw new Error(`GitHub API 요청 오류 (${userRes.status})`);
    }

    const userData: GitHubUserProfile = await userRes.json();

    // 4. Fetch user's public repositories
    const reposRes = await fetch(
      `https://api.github.com/users/${cleanTarget}/repos?sort=updated&per_page=12&type=owner`,
      { headers, next: { revalidate: 3600 } }
    );

    let recentRepos: GitHubRepoSummary[] = [];
    const languageCounts: Record<string, number> = {};
    let totalStars = 0;
    let totalForks = 0;

    if (reposRes.ok) {
      const rawRepos = await reposRes.json();
      if (Array.isArray(rawRepos)) {
        recentRepos = rawRepos.map((r: any) => {
          if (r.language) {
            languageCounts[r.language] = (languageCounts[r.language] || 0) + 1;
          }
          totalStars += r.stargazers_count || 0;
          totalForks += r.forks_count || 0;

          return {
            name: r.name,
            full_name: r.full_name,
            description: r.description,
            language: r.language,
            stargazers_count: r.stargazers_count,
            forks_count: r.forks_count,
            updated_at: r.updated_at,
            has_readme: true,
            topics: r.topics || [],
          };
        });
      }
    }

    // Calculate language percentages
    const totalLangRepos = Object.values(languageCounts).reduce((a, b) => a + b, 0);
    const languages: Record<string, number> = {};
    if (totalLangRepos > 0) {
      for (const [lang, count] of Object.entries(languageCounts)) {
        languages[lang] = Math.round((count / totalLangRepos) * 100);
      }
    }

    return {
      user: userData,
      recentRepos: recentRepos.slice(0, 6),
      languages,
      totalStars,
      totalForks,
      commitPatterns: {
        recentCommitCountEstimate: recentRepos.length * 15,
        sampleCommitMessages: [
          "update README",
          "fix bug",
          "initial commit",
          "refactor code",
        ],
      },
      analyzedAt: new Date().toISOString(),
      isMock: false,
    };
  } catch (error: any) {
    if (error.message.includes("찾을 수 없습니다")) {
      throw error;
    }
    console.error("GitHub fetch error:", error);
    // Offline / Network fallback
    return {
      ...MOCK_GITHUB_USERS["rookie-dev"],
      user: {
        ...MOCK_GITHUB_USERS["rookie-dev"].user,
        login: cleanTarget,
        name: cleanTarget,
      },
      analyzedAt: new Date().toISOString(),
      isMock: true,
    };
  }
}

export async function fetchGitHubRepoData(
  owner: string,
  repo: string,
  subPath?: string
): Promise<GitHubRepoDetailedData> {
  const fullName = `${owner}/${repo}`;
  const lowerFullName = fullName.toLowerCase();

  // 1. Check if mock repo
  if (MOCK_GITHUB_REPOS[lowerFullName]) {
    const mockRepo = MOCK_GITHUB_REPOS[lowerFullName];
    return {
      ...mockRepo,
      targetFile: subPath
        ? {
            name: subPath.split("/").pop() || subPath,
            path: subPath,
            size: 4200,
            contentPreview: mockRepo.targetFile?.contentPreview || `File: ${subPath}`,
          }
        : mockRepo.targetFile,
      analyzedAt: new Date().toISOString(),
    };
  }

  // 2. Prepare headers
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GitRoast-App",
  };

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken && !githubToken.includes("your-github")) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  try {
    // 3. Fetch repo main metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: 1800 },
    });

    if (repoRes.status === 404) {
      throw new Error(`GitHub 리포지토리 '${fullName}'를 찾을 수 없습니다. 공개(Public) 리포지토리인지 확인해 주세요. (비공개 Private 리포는 GitHub 보안 정책상 조회가 불가능합니다)`);
    }

    if (repoRes.status === 403 || repoRes.status === 429) {
      console.warn("GitHub rate limit reached, falling back to mock repo data.");
      return fallbackRepoData(owner, repo, subPath);
    }

    if (!repoRes.ok) {
      throw new Error(`GitHub API 요청 오류 (${repoRes.status})`);
    }

    const repoJson = await repoRes.json();

    // 4. Fetch repo languages
    const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
      headers,
      next: { revalidate: 3600 },
    });

    let languages: Record<string, number> = {};
    if (langRes.ok) {
      const rawLangs = await langRes.json();
      const totalBytes = Object.values(rawLangs as Record<string, number>).reduce((a, b) => a + b, 0);
      if (totalBytes > 0) {
        for (const [lang, bytes] of Object.entries(rawLangs as Record<string, number>)) {
          languages[lang] = Math.round((bytes / totalBytes) * 100);
        }
      }
    }

    // 5. Fetch recent commits
    const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=15`, {
      headers,
      next: { revalidate: 1800 },
    });

    const recentCommits: GitHubCommitInfo[] = [];
    if (commitsRes.ok) {
      const rawCommits = await commitsRes.json();
      if (Array.isArray(rawCommits)) {
        for (const c of rawCommits.slice(0, 8)) {
          const msg: string = c.commit?.message || "";
          const coAuthorMatches = Array.from(msg.matchAll(/Co-Authored-By:\s*([^\n\r]+)/gi)).map(
            (m) => m[1].trim()
          );

          recentCommits.push({
            date: c.commit?.author?.date || "",
            message: msg.split("\n")[0].slice(0, 100),
            author: c.commit?.author?.name || c.author?.login || owner,
            hasCoAuthor: coAuthorMatches.length > 0,
            coAuthorNames: coAuthorMatches,
          });
        }
      }
    }

    // 6. Fetch root files
    const contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
      headers,
      next: { revalidate: 3600 },
    });

    const files: Array<{ name: string; type: "file" | "dir"; size?: number }> = [];
    let hasReadme = false;
    let hasSpecOrDocs = false;
    let hasTests = false;
    let hasCiCd = false;

    if (contentsRes.ok) {
      const rawContents = await contentsRes.json();
      if (Array.isArray(rawContents)) {
        for (const item of rawContents) {
          files.push({
            name: item.name,
            type: item.type === "dir" ? "dir" : "file",
            size: item.size,
          });

          const lowerName = item.name.toLowerCase();
          if (lowerName.includes("readme")) hasReadme = true;
          if (lowerName.includes("spec") || lowerName.includes("doc")) hasSpecOrDocs = true;
          if (lowerName.includes("test") || lowerName.includes("__tests__")) hasTests = true;
          if (lowerName === ".github" || lowerName.includes("ci")) hasCiCd = true;
        }
      }
    }

    // 7. If subPath specified (e.g. SPEC.md)
    let targetFile: GitHubRepoDetailedData["targetFile"] = undefined;
    if (subPath) {
      try {
        const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${subPath}`, {
          headers,
        });
        if (fileRes.ok) {
          const fileJson = await fileRes.json();
          let preview = "";
          if (fileJson.content && fileJson.encoding === "base64") {
            try {
              preview = Buffer.from(fileJson.content, "base64").toString("utf-8").slice(0, 1500);
            } catch {}
          }
          targetFile = {
            name: subPath.split("/").pop() || subPath,
            path: subPath,
            size: fileJson.size,
            contentPreview: preview,
          };
          hasSpecOrDocs = true;
        }
      } catch (fErr) {
        console.warn("Could not fetch subPath file:", fErr);
      }
    }

    // 8. Fetch README content for real technical comprehension
    let readmeContent: string | undefined = undefined;
    const readmeFile = files.find((f) => /^readme(\.md|\.markdown|\.txt)?$/i.test(f.name));
    if (readmeFile) {
      try {
        const rRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${readmeFile.name}`, {
          headers,
        });
        if (rRes.ok) {
          const rJson = await rRes.json();
          if (rJson.content && rJson.encoding === "base64") {
            readmeContent = Buffer.from(rJson.content, "base64").toString("utf-8").slice(0, 2500);
          }
        }
      } catch (rErr) {
        console.warn("Could not fetch README content:", rErr);
      }
    }

    // 9. Fetch dependency manifest (package.json / requirements.txt / pom.xml / go.mod / Cargo.toml)
    let dependencyContent: string | undefined = undefined;
    const depFile = files.find((f) =>
      /^(package\.json|requirements\.txt|pom\.xml|build\.gradle|go\.mod|Cargo\.toml)$/i.test(f.name)
    );
    if (depFile) {
      try {
        const dRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${depFile.name}`, {
          headers,
        });
        if (dRes.ok) {
          const dJson = await dRes.json();
          if (dJson.content && dJson.encoding === "base64") {
            dependencyContent = `[${depFile.name}]\n` + Buffer.from(dJson.content, "base64").toString("utf-8").slice(0, 1500);
          }
        }
      } catch (dErr) {
        console.warn("Could not fetch dependency manifest:", dErr);
      }
    }

    return {
      owner: {
        login: repoJson.owner?.login || owner,
        avatar_url: repoJson.owner?.avatar_url || `https://github.com/${owner}.png`,
        html_url: repoJson.owner?.html_url || `https://github.com/${owner}`,
      },
      name: repoJson.name || repo,
      full_name: repoJson.full_name || fullName,
      description: repoJson.description,
      html_url: repoJson.html_url || `https://github.com/${fullName}`,
      stargazers_count: repoJson.stargazers_count || 0,
      forks_count: repoJson.forks_count || 0,
      open_issues_count: repoJson.open_issues_count || 0,
      watchers_count: repoJson.watchers_count || 0,
      default_branch: repoJson.default_branch || "main",
      size: repoJson.size || 0,
      license: repoJson.license?.spdx_id || repoJson.license?.name || null,
      language: repoJson.language || Object.keys(languages)[0] || "Code",
      languages,
      recentCommits,
      files: files.slice(0, 15),
      targetFile,
      hasReadme,
      hasSpecOrDocs,
      hasTests,
      hasCiCd,
      readmeContent,
      dependencyContent,
      analyzedAt: new Date().toISOString(),
      isMock: false,
    };
  } catch (error: any) {
    if (error.message.includes("찾을 수 없습니다")) {
      throw error;
    }
    console.error("fetchGitHubRepoData error:", error);
    return fallbackRepoData(owner, repo, subPath);
  }
}

function fallbackRepoData(owner: string, repo: string, subPath?: string): GitHubRepoDetailedData {
  return {
    owner: {
      login: owner,
      avatar_url: `https://github.com/${owner}.png`,
      html_url: `https://github.com/${owner}`,
    },
    name: repo,
    full_name: `${owner}/${repo}`,
    description: "GitHub 저장소 분석 (오프라인 모의 데이터 모드)",
    html_url: `https://github.com/${owner}/${repo}`,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    watchers_count: 0,
    default_branch: "main",
    size: 150,
    license: null,
    language: "JavaScript",
    languages: { JavaScript: 70, HTML: 20, CSS: 10 },
    recentCommits: [
      {
        date: new Date().toISOString(),
        message: "update codebase",
        author: owner,
        hasCoAuthor: false,
        coAuthorNames: [],
      },
    ],
    files: [
      { name: "README.md", type: "file" },
      { name: subPath || "index.js", type: "file" },
    ],
    targetFile: subPath
      ? {
          name: subPath.split("/").pop() || subPath,
          path: subPath,
          size: 1500,
        }
      : undefined,
    hasReadme: true,
    hasSpecOrDocs: !!subPath,
    hasTests: false,
    hasCiCd: false,
    analyzedAt: new Date().toISOString(),
    isMock: true,
  };
}
