export interface GitHubUserProfile {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepoSummary {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  has_readme: boolean;
  topics: string[];
}

export interface GitHubAggregatedData {
  user: GitHubUserProfile;
  recentRepos: GitHubRepoSummary[];
  languages: { [lang: string]: number };
  totalStars: number;
  totalForks: number;
  commitPatterns: {
    recentCommitCountEstimate: number;
    sampleCommitMessages: string[];
  };
  analyzedAt: string;
  isMock?: boolean;
}

export interface GitHubCommitInfo {
  date: string;
  message: string;
  author: string;
  hasCoAuthor: boolean;
  coAuthorNames: string[];
}

export interface GitHubRepoDetailedData {
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  default_branch: string;
  size: number;
  license: string | null;
  language: string | null;
  languages: { [lang: string]: number };
  recentCommits: GitHubCommitInfo[];
  files: Array<{ name: string; type: "file" | "dir"; size?: number }>;
  targetFile?: {
    name: string;
    path: string;
    size?: number;
    contentPreview?: string;
  };
  hasReadme: boolean;
  hasSpecOrDocs: boolean;
  hasTests: boolean;
  hasCiCd: boolean;
  readmeContent?: string;
  dependencyContent?: string;
  analyzedAt: string;
  isMock?: boolean;
}
