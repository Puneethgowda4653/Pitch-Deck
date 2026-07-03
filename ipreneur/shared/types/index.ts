// ─── Core Domain Types ────────────────────────────────────────────────────────

export type UUID = string;
export type ISODateString = string;

// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = "free" | "pro" | "enterprise" | "admin";

export interface User {
  id: UUID;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "draft"
  | "analyzing"
  | "researching"
  | "generating"
  | "ready"
  | "error";

export interface Project {
  id: UUID;
  userId: UUID;
  name: string;
  companyUrl: string;
  status: ProjectStatus;
  brandingData?: BrandingData;
  researchData?: ResearchData;
  deckContent?: DeckContent;
  presentationId?: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─── Branding ─────────────────────────────────────────────────────────────────

export interface BrandingData {
  companyName: string;
  tagline?: string;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  fontFamily?: string;
  tone?: "formal" | "casual" | "technical" | "creative";
  industry?: string;
  targetAudience?: string;
}

// ─── Research ─────────────────────────────────────────────────────────────────

export interface ResearchData {
  marketSize?: string;
  competitors?: Competitor[];
  trends?: string[];
  painPoints?: string[];
  opportunities?: string[];
  fundingLandscape?: string;
  traction?: TractionData;
}

export interface Competitor {
  name: string;
  url?: string;
  description: string;
  weakness?: string;
}

export interface TractionData {
  users?: string;
  revenue?: string;
  growth?: string;
  partnerships?: string[];
}

// ─── Deck Content ─────────────────────────────────────────────────────────────

export interface DeckContent {
  slides: DeckSlide[];
  theme: DeckTheme;
  metadata: DeckMetadata;
}

export type SlideType =
  | "cover"
  | "problem"
  | "solution"
  | "market"
  | "product"
  | "traction"
  | "business_model"
  | "go_to_market"
  | "competition"
  | "team"
  | "financials"
  | "ask"
  | "custom";

export interface DeckSlide {
  id: UUID;
  type: SlideType;
  order: number;
  title: string;
  subtitle?: string;
  content: SlideContent;
  notes?: string;
  layout: SlideLayout;
}

export interface SlideContent {
  bullets?: string[];
  bodyText?: string;
  chart?: ChartConfig;
  imageUrl?: string;
  stats?: Stat[];
  quote?: string;
  cta?: string;
}

export interface Stat {
  value: string;
  label: string;
  description?: string;
}

export type SlideLayout =
  | "title_only"
  | "title_content"
  | "title_bullets"
  | "two_column"
  | "big_number"
  | "image_right"
  | "image_left"
  | "full_bleed"
  | "chart_focus";

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "donut" | "area";
  title?: string;
  data: ChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// ─── Deck Theme ───────────────────────────────────────────────────────────────

export interface DeckTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  accentColor: string;
  fontTitle: string;
  fontBody: string;
  style: "dark" | "light" | "gradient";
}

export interface DeckMetadata {
  title: string;
  subtitle?: string;
  version: string;
  generatedAt: ISODateString;
  slideCount: number;
}

// ─── Presentation ─────────────────────────────────────────────────────────────

export interface Presentation {
  id: UUID;
  projectId: UUID;
  userId: UUID;
  fileUrl?: string;
  thumbnailUrl?: string;
  status: "pending" | "generating" | "ready" | "error";
  format: "pptx" | "pdf";
  createdAt: ISODateString;
}

// ─── Job / Workflow ───────────────────────────────────────────────────────────

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobStep =
  | "crawling"
  | "extracting_branding"
  | "researching"
  | "generating_content"
  | "rendering_ppt"
  | "uploading";

export interface JobProgress {
  jobId: UUID;
  projectId: UUID;
  status: JobStatus;
  currentStep: JobStep;
  stepProgress: number; // 0–100
  totalProgress: number; // 0–100
  message: string;
  error?: string;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export type PlanTier = "free" | "starter" | "pro" | "enterprise";

export interface Plan {
  tier: PlanTier;
  name: string;
  price: number;
  currency: "USD";
  interval: "month" | "year";
  features: PlanFeature[];
  limits: PlanLimits;
}

export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
}

export interface PlanLimits {
  projectsPerMonth: number;
  slidesPerDeck: number;
  exportsPerMonth: number;
  teamMembers: number;
}
