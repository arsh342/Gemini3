/**
 * The Repo Archaeologist - Type Definitions
 * Core types for the multi-agent investigation system
 */

// ============================================
// Evidence Types
// ============================================

export interface BlameData {
  commitHash: string;
  author: string;
  authorEmail: string;
  timestamp: Date;
  lineNumber: number;
  lineContent: string;
}

export interface CommitInfo {
  hash: string;
  author: string;
  authorEmail: string;
  date: Date;
  message: string;
  diff: string;
  changedFiles: string[];
}

export interface PRData {
  number: number;
  title: string;
  body: string;
  author: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
  createdAt: Date;
  mergedAt: Date | null;
  comments: PRComment[];
  reviews: PRReview[];
  linkedIssues: number[];
}

export interface PRComment {
  id: number;
  author: string;
  body: string;
  createdAt: Date;
}

export interface PRReview {
  id: number;
  author: string;
  state: 'approved' | 'changes_requested' | 'commented';
  body: string;
  createdAt: Date;
}

export interface IssueData {
  number: number;
  title: string;
  body: string;
  author: string;
  state: 'open' | 'closed';
  url: string;
  createdAt: Date;
  closedAt: Date | null;
  labels: string[];
  comments: IssueComment[];
}

export interface IssueComment {
  id: number;
  author: string;
  body: string;
  createdAt: Date;
}

// ============================================
// Evidence Container
// ============================================

export type EvidenceType = 'blame' | 'commit' | 'pr' | 'issue' | 'file_history';

export interface Evidence {
  type: EvidenceType;
  data: BlameData | CommitInfo | PRData | IssueData | CommitInfo[];
  timestamp: Date;
  source: string; // e.g., "git blame", "GitHub API"
}

// ============================================
// Thought Signatures (Gemini 3 Feature)
// ============================================

export interface ThoughtSignature {
  signature: string;
  timestamp: Date;
  agentId: string;
  step: number;
}

export interface ThoughtChain {
  signatures: ThoughtSignature[];
  totalSteps: number;
}

// ============================================
// Case File (Investigation State)
// ============================================

export interface CodeSelection {
  text: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  repoPath: string;
  repoOwner?: string;
  repoName?: string;
}

export interface CaseFile {
  id: string;
  codeSelection: CodeSelection;
  evidence: Evidence[];
  thoughtChain: ThoughtChain;
  status: 'investigating' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  confidence: number;
}

// ============================================
// Investigation Results
// ============================================

export interface InvestigationResult {
  narrative: string;
  summary: string;
  confidence: number;
  sources: Source[];
  recommendations: Recommendation[];
  timeline: TimelineEvent[];
  thoughtChain: ThoughtChain;
}

export interface Source {
  type: 'commit' | 'pr' | 'issue' | 'comment';
  id: string;
  url?: string;
  description: string;
}

export interface Recommendation {
  action: 'keep' | 'refactor' | 'document' | 'remove' | 'investigate';
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export interface TimelineEvent {
  date: Date;
  type: EvidenceType;
  title: string;
  description: string;
  author: string;
  sourceId: string;
  sourceUrl?: string;
}

// ============================================
// Agent Interfaces
// ============================================

export interface AgentConfig {
  apiKey: string;
  model: string;
  thinkingLevel: 'low' | 'medium' | 'high';
  temperature: number;
}

export interface AgentResponse<T> {
  data: T;
  thoughtSignature?: ThoughtSignature;
  tokensUsed: number;
  latencyMs: number;
}

// ============================================
// Streaming Types (for real-time UI)
// ============================================

export type InvestigationPhase = 
  | 'initializing'
  | 'analyzing_blame'
  | 'fetching_commits'
  | 'searching_prs'
  | 'reading_issues'
  | 'synthesizing'
  | 'completed'
  | 'failed';

export interface StreamUpdate {
  phase: InvestigationPhase;
  message: string;
  progress: number; // 0-100
  thinkingBadge?: 'LOW' | 'MEDIUM' | 'HIGH';
  partialResult?: Partial<InvestigationResult>;
}

export type StreamCallback = (update: StreamUpdate) => void;

// ============================================
// Export Types
// ============================================

export interface MarkdownExport {
  content: string;
  filename: string;
}

export interface ADRExport {
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string;
}
