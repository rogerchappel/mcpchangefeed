export type McpServer = {
  id: string;
  name: string;
  description: string;
  category: string;
  homepage?: string;
  repository?: string;
  packageName?: string;
  packageRegistry?: "npm" | "pypi" | "docker" | "other";
  version?: string;
  license?: string;
  install?: string;
  tags: string[];
  signals: {
    stars?: number;
    forks?: number;
    downloads?: number;
    lastPublishedAt?: string;
    lastCommitAt?: string;
    hasReadme?: boolean;
    hasExamples?: boolean;
    hasLicense?: boolean;
  };
};

export type ScoredServer = McpServer & {
  score: number;
  warnings: string[];
};

export type ServerDiff = {
  added: McpServer[];
  removed: McpServer[];
  changed: Array<{
    before: McpServer;
    after: McpServer;
    fields: string[];
  }>;
};
