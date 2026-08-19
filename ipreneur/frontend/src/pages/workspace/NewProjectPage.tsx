import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Globe, Sparkles, ArrowRight, ArrowLeft, Upload, X, Image as ImageIcon, Plus } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";

import { projectsApi } from "@/services/api/projects";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Card } from "@/components/ui/Card";

const trimOrUndefined = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : v);

const founderSchema = z.object({
  name: z.preprocess(trimOrUndefined, z.string().optional()),
  role: z.preprocess(trimOrUndefined, z.string().optional()),
  oneLiner: z.preprocess(trimOrUndefined, z.string().max(140).optional()),
});

const baseSchema = z.object({
  hasWebsite: z.boolean().default(true),
  companyUrl: z.string().optional(),
  name: z.string().min(1, "Project name is required").max(80),
  companyName: z.preprocess(trimOrUndefined, z.string().max(80).optional()),
  industry: z.preprocess(trimOrUndefined, z.string().max(80).optional()),
  problemStatement: z.preprocess(trimOrUndefined, z.string().max(600).optional()),
  solutionDescription: z.preprocess(trimOrUndefined, z.string().max(600).optional()),
  targetCustomer: z.preprocess(trimOrUndefined, z.string().max(120).optional()),
  tractionNotes: z.preprocess(trimOrUndefined, z.string().max(400).optional()),
  competitorNotes: z.preprocess(trimOrUndefined, z.string().max(200).optional()),
  founders: z.array(founderSchema).default([]),
  businessModel: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["saas", "marketplace", "services", "ecommerce", "fintech", "hardware", "other"]).optional()
  ),
  fundingStage: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["idea", "pre_revenue", "pre_seed", "seed", "series_a", "series_b", "growth", "bootstrapped"]).optional()
  ),
  arrUsd: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().positive().optional()
  ),
  mrrUsd: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().positive().optional()
  ),
  totalCustomers: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().positive().optional()
  ),
  monthlyActiveUsers: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().positive().optional()
  ),
  askAmountUsd: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().positive().optional()
  ),
  startImmediately: z.boolean().default(true),
});

const schema = baseSchema.superRefine((data, ctx) => {
  if (data.hasWebsite) {
    if (!data.companyUrl?.trim()) {
      ctx.addIssue({ path: ["companyUrl"], code: z.ZodIssueCode.custom, message: "URL is required" });
    } else if (!z.string().url().safeParse(data.companyUrl).success) {
      ctx.addIssue({ path: ["companyUrl"], code: z.ZodIssueCode.custom, message: "Please enter a valid URL (include https://)" });
    }
  } else {
    if (!data.companyName?.trim()) ctx.addIssue({ path: ["companyName"], code: z.ZodIssueCode.custom, message: "Company name is required" });
    if (!data.industry?.trim()) ctx.addIssue({ path: ["industry"], code: z.ZodIssueCode.custom, message: "Industry is required" });
    if (!data.problemStatement?.trim()) ctx.addIssue({ path: ["problemStatement"], code: z.ZodIssueCode.custom, message: "What problem are you solving?" });
    if (!data.solutionDescription?.trim()) ctx.addIssue({ path: ["solutionDescription"], code: z.ZodIssueCode.custom, message: "What are you building?" });
    if (!data.founders.length || !data.founders[0]?.name?.trim()) {
      ctx.addIssue({ path: ["founders", 0, "name"], code: z.ZodIssueCode.custom, message: "Add at least one founder" });
    } else if (!data.founders[0]?.role?.trim()) {
      ctx.addIssue({ path: ["founders", 0, "role"], code: z.ZodIssueCode.custom, message: "Role is required" });
    }
  }
});

type FormData = z.infer<typeof schema>;

const EXAMPLES = ["stripe.com", "notion.so", "figma.com", "ramp.com"];

const ndS = {
  page: { maxWidth: 560, margin: "0 auto", padding: "30px 24px 60px" } as React.CSSProperties,
  back: { display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "none", cursor: "pointer", font: "500 13px var(--font-body)", color: "var(--text-muted)", marginBottom: 26, padding: 0, textDecoration: "none" } as React.CSSProperties,
  head: { textAlign: "center", marginBottom: 26 } as React.CSSProperties,
  mark: { width: 56, height: 56, margin: "0 auto 16px", borderRadius: "var(--radius-lg)", background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "var(--glow-brand)" } as React.CSSProperties,
  h1: { font: "800 28px var(--font-display)", letterSpacing: "-0.03em", color: "var(--text-strong)" } as React.CSSProperties,
  sub: { marginTop: 7, font: "400 15px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  form: { padding: 26, display: "flex", flexDirection: "column", gap: 18 } as React.CSSProperties,
  examples: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 9 } as React.CSSProperties,
  exBtn: { border: 0, background: "none", cursor: "pointer", font: "500 12px var(--font-body)", color: "var(--text-faint)", padding: 0, transition: "color var(--dur-base)" } as React.CSSProperties,
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 16px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" } as React.CSSProperties,
  toggleTitle: { font: "600 13px var(--font-body)", color: "var(--text-strong)" } as React.CSSProperties,
  toggleSub: { marginTop: 3, font: "400 12px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  trust: { textAlign: "center", marginTop: 18, font: "400 12px var(--font-body)", color: "var(--text-faint)" } as React.CSSProperties,
  sectionHead: { font: "600 13px var(--font-body)", color: "var(--text-strong)", marginBottom: 14 } as React.CSSProperties,
  advToggle: { border: 0, background: "none", cursor: "pointer", font: "500 12px var(--font-body)", color: "var(--text-brand)", padding: 0 } as React.CSSProperties,
  sectionRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } as React.CSSProperties,
  advSection: { padding: "14px 16px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 14 } as React.CSSProperties,
  uploadLabel: { font: "600 12px var(--font-body)", color: "var(--text-strong)", marginBottom: 8 } as React.CSSProperties,
  uploadHint: { font: "400 11px var(--font-body)", color: "var(--text-faint)" } as React.CSSProperties,
  dropZone: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", border: "1.5px dashed var(--border-default)", borderRadius: "var(--radius-md)", cursor: "pointer", font: "500 12.5px var(--font-body)", color: "var(--text-muted)", background: "var(--surface-page)" } as React.CSSProperties,
  logoRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-page)" } as React.CSSProperties,
  logoPreview: { width: 40, height: 40, borderRadius: 8, objectFit: "contain", background: "#fff" } as React.CSSProperties,
  fileName: { flex: 1, font: "500 12px var(--font-body)", color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as React.CSSProperties,
  removeBtn: { border: 0, background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4 } as React.CSSProperties,
  thumbGrid: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 } as React.CSSProperties,
  thumbWrap: { position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-default)" } as React.CSSProperties,
  thumb: { width: "100%", height: "100%", objectFit: "cover", display: "block" } as React.CSSProperties,
  thumbX: { position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", border: 0, background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 } as React.CSSProperties,
  founderRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "start" } as React.CSSProperties,
};

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startNow, setStartNow] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      hasWebsite: true,
      companyUrl: "",
      name: "",
      founders: [{ name: "", role: "", oneLiner: "" }],
      startImmediately: true,
    },
  });

  const { fields: founderFields, append: appendFounder, remove: removeFounder } = useFieldArray({
    control,
    name: "founders",
  });

  const hasWebsite = watch("hasWebsite");

  const { mutate: createProject, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      projectsApi.create({
        name: data.name,
        companyUrl: data.hasWebsite ? data.companyUrl : undefined,
        startAnalysis: data.startImmediately,
        brandingData: {
          company_name: data.companyName,
          industry: data.industry,
          business_model: data.businessModel,
          funding_stage: data.fundingStage,
          arr_usd: data.arrUsd,
          mrr_usd: data.mrrUsd,
          total_customers: data.totalCustomers,
          monthly_active_users: data.monthlyActiveUsers,
          ask_amount_usd: data.askAmountUsd,
          ...(!data.hasWebsite && {
            problem_statement: data.problemStatement,
            solution_description: data.solutionDescription,
            target_customer: data.targetCustomer,
            traction_notes: data.tractionNotes,
            competitor_notes: data.competitorNotes,
            founders: data.founders
              .filter((f) => f.name?.trim())
              .map((f) => ({ name: f.name || "", role: f.role || "", one_liner: f.oneLiner })),
          }),
        },
      }),
    onSuccess: async (project) => {
      // Upload logo/photos to the new project (render-time assets — safe to run
      // alongside generation). Don't block navigation if the upload fails.
      if (logoFile || galleryFiles.length) {
        try {
          await projectsApi.uploadAssets(project.id, { logo: logoFile, gallery: galleryFiles });
        } catch (e: any) {
          toast.error(e?.response?.data?.detail || "Images couldn't be uploaded");
        }
      }
      toast.success("Project created!");
      navigate(`/projects/${project.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to create project");
    },
  });

  const onSubmit = (data: FormData) => {
    data.startImmediately = startNow;
    createProject(data);
  };

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100vh" }}>
      <div style={ndS.page}>
        <Link to="/dashboard" style={ndS.back}>
          <ArrowLeft size={15} /> Dashboard
        </Link>

        <div style={ndS.head}>
          <div style={ndS.mark}><Sparkles size={26} /></div>
          <h1 style={ndS.h1}>Create your pitch deck</h1>
          <p style={ndS.sub}>
            {hasWebsite ? "Drop in a company URL. Our AI does the rest." : "Tell us about your idea. Our AI does the rest."}
          </p>
        </div>

        <Card padding="none" style={{ overflow: "hidden" }}>
          <form onSubmit={handleSubmit(onSubmit)} style={ndS.form}>
            {/* No-website toggle */}
            <div style={ndS.toggleRow}>
              <div>
                <div style={ndS.toggleTitle}>I don't have a website yet</div>
                <div style={ndS.toggleSub}>New/idea-stage company — tell us about it instead</div>
              </div>
              <Switch checked={!hasWebsite} onChange={(v) => setValue("hasWebsite", !v, { shouldValidate: true })} />
            </div>

            {hasWebsite ? (
              /* Company URL */
              <div>
                <Input
                  label="Company website"
                  icon={<Globe size={16} />}
                  {...register("companyUrl")}
                  type="text"
                  placeholder="https://yourcompany.com"
                  error={errors.companyUrl?.message}
                />
                <div style={ndS.examples}>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      style={ndS.exBtn}
                      onClick={() => setValue("companyUrl", "https://" + ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Manual company intake — no website to crawl */
              <div style={ndS.advSection}>
                <div style={ndS.sectionHead}>Tell us about your company</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={ndS.twoCol}>
                    <Input label="Company name" {...register("companyName")} placeholder="e.g. Zomato" error={errors.companyName?.message} />
                    <Input label="Industry" {...register("industry")} placeholder="e.g. Fintech, SaaS" error={errors.industry?.message} />
                  </div>
                  <Input
                    label="What problem are you solving?"
                    multiline
                    rows={3}
                    {...register("problemStatement")}
                    placeholder="Who has this pain, and what does it cost them today?"
                    error={errors.problemStatement?.message}
                  />
                  <Input
                    label="What are you building?"
                    multiline
                    rows={3}
                    {...register("solutionDescription")}
                    placeholder="Your product/solution and what makes it different"
                    error={errors.solutionDescription?.message}
                  />
                  <Input
                    label="Target customer"
                    hint="optional"
                    {...register("targetCustomer")}
                    placeholder="e.g. Mid-market logistics companies in India"
                  />

                  <div>
                    <div style={ndS.uploadLabel}>Founders</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {founderFields.map((field, i) => (
                        <div key={field.id} style={ndS.founderRow}>
                          <Input
                            {...register(`founders.${i}.name` as const)}
                            placeholder="Full name"
                            error={i === 0 ? errors.founders?.[0]?.name?.message : undefined}
                          />
                          <Input
                            {...register(`founders.${i}.role` as const)}
                            placeholder="Role, e.g. Co-founder & CEO"
                            error={i === 0 ? errors.founders?.[0]?.role?.message : undefined}
                          />
                          <Input
                            {...register(`founders.${i}.oneLiner` as const)}
                            placeholder="Background (optional), e.g. Ex-Google PM"
                          />
                          {founderFields.length > 1 && (
                            <button type="button" style={ndS.removeBtn} onClick={() => removeFounder(i)}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      style={{ ...ndS.exBtn, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => appendFounder({ name: "", role: "", oneLiner: "" })}
                    >
                      <Plus size={13} /> Add founder
                    </button>
                  </div>

                  <Input
                    label="Early validation / traction"
                    hint="optional — e.g. waitlist signups, LOIs, pilot users"
                    multiline
                    rows={2}
                    {...register("tractionNotes")}
                    placeholder="Leave blank if pre-launch — we won't invent traction"
                  />
                  <Input
                    label="Known competitors"
                    hint="optional, comma-separated"
                    {...register("competitorNotes")}
                    placeholder="e.g. Acme Inc, Beta Corp"
                  />
                </div>
              </div>
            )}

            {/* Project name */}
            <Input
              label="Project name"
              {...register("name")}
              placeholder="e.g. Series A deck"
              error={errors.name?.message}
            />

            {/* Funding stage + Business model */}
            <div style={ndS.twoCol}>
              <Select
                label="Funding stage"
                {...register("fundingStage")}
                options={[
                  { value: "", label: "Select stage" },
                  { value: "idea", label: "Idea" },
                  { value: "pre_revenue", label: "Pre-revenue" },
                  { value: "pre_seed", label: "Pre-seed" },
                  { value: "seed", label: "Seed" },
                  { value: "series_a", label: "Series A" },
                  { value: "series_b", label: "Series B" },
                  { value: "growth", label: "Growth" },
                  { value: "bootstrapped", label: "Bootstrapped" },
                ]}
              />
              <Select
                label="Business model"
                hint="AI will detect"
                {...register("businessModel")}
                options={[
                  { value: "", label: "Select model" },
                  { value: "saas", label: "SaaS" },
                  { value: "marketplace", label: "Marketplace" },
                  { value: "services", label: "Services" },
                  { value: "ecommerce", label: "Ecommerce" },
                  { value: "fintech", label: "Fintech" },
                  { value: "hardware", label: "Hardware" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>

            {/* Optional company details */}
            <div style={ndS.advSection}>
              <div style={ndS.sectionRow}>
                <div style={ndS.sectionHead}>Optional details</div>
                <button type="button" style={ndS.advToggle} onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Hide" : "Add company details"}
                </button>
              </div>

              {showAdvanced && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {hasWebsite && (
                    <div style={ndS.twoCol}>
                      <Input label="Company name" {...register("companyName")} placeholder="e.g. Zomato" />
                      <Input label="Industry" hint="AI will detect" {...register("industry")} placeholder="e.g. Fintech, SaaS" />
                    </div>
                  )}
                  <div style={ndS.twoCol}>
                    <Input label="ARR (USD)" {...register("arrUsd")} type="number" placeholder="e.g. 1200000" />
                    <Input label="MRR (USD)" {...register("mrrUsd")} type="number" placeholder="e.g. 100000" />
                  </div>
                  <div style={ndS.twoCol}>
                    <Input label="Total customers" {...register("totalCustomers")} type="number" placeholder="e.g. 2500" />
                    <Input label="Monthly active users" {...register("monthlyActiveUsers")} type="number" placeholder="e.g. 120000" />
                  </div>
                  <Input label="Ask amount (USD)" {...register("askAmountUsd")} type="number" placeholder="e.g. 1500000" />

                  {/* Logo upload */}
                  <div>
                    <div style={ndS.uploadLabel}>Company logo <span style={ndS.uploadHint}>· shown on every slide</span></div>
                    {logoFile ? (
                      <div style={ndS.logoRow}>
                        <img src={URL.createObjectURL(logoFile)} alt="logo" style={ndS.logoPreview} />
                        <span style={ndS.fileName}>{logoFile.name}</span>
                        <button type="button" style={ndS.removeBtn} onClick={() => setLogoFile(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <label style={ndS.dropZone}>
                        <Upload size={15} /> <span>Upload logo (PNG/SVG)</span>
                        <input type="file" accept="image/*" style={{ display: "none" }}
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>

                  {/* Gallery photos */}
                  <div>
                    <div style={ndS.uploadLabel}>Gallery photos <span style={ndS.uploadHint}>· up to 5, shown on the Gallery slide</span></div>
                    {galleryFiles.length > 0 && (
                      <div style={ndS.thumbGrid}>
                        {galleryFiles.map((f, i) => (
                          <div key={i} style={ndS.thumbWrap}>
                            <img src={URL.createObjectURL(f)} alt={f.name} style={ndS.thumb} />
                            <button type="button" style={ndS.thumbX}
                              onClick={() => setGalleryFiles((prev) => prev.filter((_, k) => k !== i))}><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {galleryFiles.length < 5 && (
                      <label style={{ ...ndS.dropZone, marginTop: galleryFiles.length ? 10 : 0 }}>
                        <ImageIcon size={15} /> <span>Add photos ({galleryFiles.length}/5)</span>
                        <input type="file" accept="image/*" multiple style={{ display: "none" }}
                          onChange={(e) => {
                            const picked = Array.from(e.target.files || []);
                            setGalleryFiles((prev) => [...prev, ...picked].slice(0, 5));
                            e.target.value = "";
                          }} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Generate immediately toggle */}
            <div style={ndS.toggleRow}>
              <div>
                <div style={ndS.toggleTitle}>Generate immediately</div>
                <div style={ndS.toggleSub}>Start AI analysis right after creating</div>
              </div>
              <Switch checked={startNow} onChange={setStartNow} />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isPending}
              iconRight={!isPending ? <ArrowRight size={16} /> : undefined}
            >
              {isPending ? "Creating…" : "Create Deck"}
            </Button>
          </form>
        </Card>

        <p style={ndS.trust}>Analysis takes ~2 minutes · PPTX output · Fully editable</p>
      </div>
    </div>
  );
}
