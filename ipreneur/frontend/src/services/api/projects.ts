import { apiClient } from "@/services/api/client";
import type { Project, JobProgress } from "@/types";

interface CreateProjectPayload {
  name: string;
  companyUrl: string;
  startAnalysis?: boolean;
  brandingData?: {
    company_name?: string;
    industry?: string;
    business_model?: string;
    funding_stage?: string;
    arr_usd?: number;
    mrr_usd?: number;
    total_customers?: number;
    monthly_active_users?: number;
    ask_amount_usd?: number;
  };
}

interface ListProjectsParams {
  page?: number;
  pageSize?: number;
}

interface ProjectListResponse {
  data: Project[];
  total: number;
  page: number;
  page_size: number;
  has_next_page: boolean;
}

export const projectsApi = {
  // Returns { data: Project[], total, page, ... }
  list: async (params?: ListProjectsParams): Promise<ProjectListResponse> => {
    const { data } = await apiClient.get("/projects", {
      params: { page: params?.page, page_size: params?.pageSize },
    });
    return data;
  },

  // Returns Project directly
  get: async (id: string): Promise<Project> => {
    const { data } = await apiClient.get(`/projects/${id}`);
    return data;
  },

  // Returns Project directly — backend uses snake_case keys
  create: async (payload: CreateProjectPayload): Promise<Project> => {
    const { data } = await apiClient.post("/projects", {
      name: payload.name,
      company_url: payload.companyUrl,
      start_analysis: payload.startAnalysis ?? false,
      branding_data: payload.brandingData ?? null,
    });
    return data;
  },

  // Persist editable fields (e.g. chosen template). Backend expects snake_case.
  update: async (id: string, payload: { name?: string; templateKey?: string }): Promise<Project> => {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.templateKey !== undefined) body.template_key = payload.templateKey;
    const { data } = await apiClient.put(`/projects/${id}`, body);
    return data;
  },

  // Upload company logo and/or gallery photos (multipart). Render-time only.
  uploadAssets: async (
    id: string,
    files: { logo?: File | null; gallery?: File[] }
  ): Promise<Project> => {
    const form = new FormData();
    if (files.logo) form.append("logo", files.logo);
    (files.gallery || []).slice(0, 5).forEach((f) => form.append("gallery", f));
    // Drop the instance's default JSON content-type so the browser sets
    // multipart/form-data WITH its boundary (axios 1.x then leaves it intact).
    const { data } = await apiClient.post(`/projects/${id}/assets`, form, {
      headers: { "Content-Type": undefined },
    });
    return data;
  },

  // Returns JobProgressResponse directly
  analyze: async (id: string): Promise<JobProgress> => {
    const { data } = await apiClient.post(`/projects/${id}/analyze`);
    return data;
  },

  // Returns JobProgressResponse directly
  getStatus: async (id: string): Promise<JobProgress> => {
    const { data } = await apiClient.get(`/projects/${id}/status`);
    return data;
  },

  // Returns blob for download
  export: async (id: string, format: "pptx" | "pdf" = "pptx"): Promise<Blob> => {
    const { data } = await apiClient.get(`/presentations/${id}/download`, {
      params: { format },
      responseType: "blob",
    });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
};
