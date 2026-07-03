export interface User {
  id: string;
  email: string;
  name: string;
  role: "free" | "pro" | "enterprise" | "admin";
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string;
}

export interface BrandingData {
  companyName?: string;
  tagline?: string;
  industry?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface DeckSlide {
  id: string;
  type?: string;
  title?: string;
  content?: string;
}

export interface DeckContent {
  slides?: DeckSlide[];
}

export interface Project {
  id: string;
  userId?: string;
  user_id?: string;
  name: string;
  companyUrl?: string;
  company_url?: string;
  status: "draft" | "analyzing" | "researching" | "generating" | "ready" | "error";
  brandingData?: BrandingData;
  branding_data?: Record<string, unknown>;
  researchData?: Record<string, unknown>;
  research_data?: Record<string, unknown>;
  deckContent?: DeckContent;
  deck_content?: Record<string, unknown>;
  errorMessage?: string;
  error_message?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface JobProgress {
  jobId?: string;
  job_id?: string;
  projectId?: string;
  project_id?: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep?: string;
  current_step?: string;
  stepProgress?: number;
  step_progress?: number;
  totalProgress?: number;
  total_progress?: number;
  message: string;
  error?: string | null;
  startedAt?: string | null;
  started_at?: string | null;
  completedAt?: string | null;
  completed_at?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize?: number;
  page_size?: number;
  hasNextPage?: boolean;
  has_next_page?: boolean;
}
