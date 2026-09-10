import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Globe, ArrowRight, ArrowLeft, Upload, X, Image as ImageIcon, Plus,
  TrendingUp, Target, Layers, Handshake, ClipboardCheck, Activity, Compass, Check,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";

import { projectsApi } from "@/services/api/projects";
import { deckTypesApi, type DeckTypeOption } from "@/services/api/deckTypes";
import {
  DECK_TYPES as DECK_TYPE_SECTIONS,
  slideOrder,
} from "@/components/workspace/deckTemplates/deckTypes";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";

const trimOrUndefined = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : v);

const founderSchema = z.object({
  name: z.preprocess(trimOrUndefined, z.string().optional()),
  role: z.preprocess(trimOrUndefined, z.string().optional()),
  oneLiner: z.preprocess(trimOrUndefined, z.string().max(140).optional()),
});

const baseSchema = z.object({
  deckType: z.string().default("investor"),
  deckFormat: z.enum(["presenter", "standalone"]).default("presenter"),
  /* Answers to the selected deck type's own questions, keyed by the
   * backend BriefField.name. Validated at submit against the fetched
   * registry rather than in zod, which cannot see server-driven fields. */
  brief: z.record(z.string()).default({}),
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
  }
  // Which company details are mandatory depends on the deck type, and that
  // list lives in the backend registry (GET /deck-types) — see
  // validateForDeckType() below, which runs on submit once it has loaded.
});

/** Backend shared-field name → the form field that collects it. */
const SHARED_FIELD_FORM_NAMES: Record<string, string> = {
  company_name: "companyName",
  industry: "industry",
  problem_statement: "problemStatement",
  solution_description: "solutionDescription",
  target_customer: "targetCustomer",
  traction_notes: "tractionNotes",
  competitor_notes: "competitorNotes",
  founders: "founders",
};

type FormData = z.infer<typeof schema>;

const EXAMPLES = ["stripe.com", "notion.so", "figma.com", "ramp.com"];

/** One icon per deck type, so the seven choices are distinguishable at a glance. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  investor: TrendingUp,
  sales: Target,
  product: Layers,
  partnership: Handshake,
  internal: ClipboardCheck,
  update: Activity,
  vision: Compass,
};

/**
 * Readable slide names for the running-order preview.
 *
 * Reuses the deck registry's own eyebrow labels rather than a second table
 * that could drift from what the deck actually renders.
 */
function slideLabels(deckType: string): string[] {
  return slideOrder(deckType).map((slot) =>
    slot.eyebrow || slot.key.charAt(0).toUpperCase() + slot.key.slice(1)
  );
}

const ndS = {
  page: { maxWidth: 880, margin: "0 auto", padding: "26px 24px 64px" } as React.CSSProperties,
  back: { display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "none", cursor: "pointer", font: "500 13px var(--font-body)", color: "var(--text-muted)", marginBottom: 22, padding: 0, textDecoration: "none" } as React.CSSProperties,

  // ── Step indicator ──────────────────────────────────────────────────────
  steps: { display: "flex", alignItems: "center", gap: 12, marginBottom: 30 } as React.CSSProperties,
  stepBtn: { display: "flex", alignItems: "center", gap: 11, border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "left" } as React.CSSProperties,
  stepNum: { width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px var(--font-body)", flexShrink: 0 } as React.CSSProperties,
  stepNumOn: { background: "var(--clay-500)", color: "var(--text-on-brand)", boxShadow: "var(--clay-raise-sm)" } as React.CSSProperties,
  stepNumOff: { background: "var(--surface-sunken)", color: "var(--text-faint)", border: "1px solid var(--border-subtle)" } as React.CSSProperties,
  stepName: { font: "600 13px var(--font-body)", color: "var(--text-strong)", lineHeight: 1.2 } as React.CSSProperties,
  stepNameOff: { color: "var(--text-faint)" } as React.CSSProperties,
  stepSub: { marginTop: 2, font: "400 11.5px var(--font-body)", color: "var(--text-faint)" } as React.CSSProperties,
  stepBar: { flex: 1, height: 1, background: "var(--border-subtle)" } as React.CSSProperties,

  head: { marginBottom: 22 } as React.CSSProperties,
  h1: { font: "800 30px var(--font-display)", letterSpacing: "-0.03em", color: "var(--text-strong)", margin: 0 } as React.CSSProperties,
  sub: { marginTop: 8, font: "400 14.5px var(--font-body)", color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.5 } as React.CSSProperties,

  // ── Deck type picker ────────────────────────────────────────────────────
  typeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  typeCard: { position: "relative", textAlign: "left", padding: "20px 22px 18px", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--glass-edge)", background: "var(--glass-2)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-rim), var(--shadow-sm)", cursor: "pointer", transition: "border-color var(--dur-base), background var(--dur-base), box-shadow var(--dur-base)", display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
  typeCardOn: { borderColor: "var(--border-brand)", background: "var(--brand-subtle)", boxShadow: "var(--glass-rim), 0 8px 22px -6px rgba(255,122,89,.35)" } as React.CSSProperties,
  typeCardWide: { gridColumn: "1 / -1" } as React.CSSProperties,
  typeTop: { display: "flex", alignItems: "flex-start", gap: 12 } as React.CSSProperties,
  typeIcon: { width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "var(--clay-500)", color: "var(--text-on-brand)", boxShadow: "var(--clay-raise-sm)" } as React.CSSProperties,
  typeIconOff: { background: "var(--clay-50)", color: "var(--clay-700)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.95)" } as React.CSSProperties,
  typeName: { font: "700 15px var(--font-display)", letterSpacing: "-0.01em", color: "var(--text-strong)" } as React.CSSProperties,
  typeDesc: { marginTop: 4, font: "400 12.5px var(--font-body)", color: "var(--text-muted)", lineHeight: 1.45 } as React.CSSProperties,
  typeCount: { font: "500 11.5px var(--font-body)", color: "var(--text-faint)", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "auto" } as React.CSSProperties,
  marks: { display: "flex", gap: 3, alignItems: "center" } as React.CSSProperties,
  mark: { width: 7, height: 3, borderRadius: 2, background: "var(--neutral-400)" } as React.CSSProperties,
  markOn: { background: "var(--clay-400)" } as React.CSSProperties,
  tick: { position: "absolute", top: 14, right: 16, width: 18, height: 18, borderRadius: "50%", background: "var(--clay-500)", color: "var(--text-on-brand)", boxShadow: "var(--clay-raise-sm)", display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,

  // ── Running order preview ───────────────────────────────────────────────
  order: { marginTop: 18, padding: "16px 18px", background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)" } as React.CSSProperties,
  orderHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 } as React.CSSProperties,
  orderTitle: { font: "600 12.5px var(--font-body)", color: "var(--text-strong)" } as React.CSSProperties,
  orderMeta: { font: "400 11.5px var(--font-body)", color: "var(--text-faint)" } as React.CSSProperties,
  chips: { display: "flex", flexWrap: "wrap", gap: 7 } as React.CSSProperties,
  chip: { font: "500 11.5px var(--font-body)", color: "var(--text-body)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: 999, padding: "5px 11px" } as React.CSSProperties,
  chipNum: { color: "var(--text-faint)", marginRight: 5 } as React.CSSProperties,

  // ── Step 2 ──────────────────────────────────────────────────────────────
  chosen: { display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: "var(--radius-lg)", border: "1px solid var(--glass-edge)", background: "var(--glass-2)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-rim), var(--shadow-sm)", marginBottom: 18 } as React.CSSProperties,
  chosenName: { font: "700 14px var(--font-display)", color: "var(--text-strong)" } as React.CSSProperties,
  chosenMeta: { marginTop: 2, font: "400 12px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  changeBtn: { marginLeft: "auto", border: 0, background: "none", cursor: "pointer", font: "600 12.5px var(--font-body)", color: "var(--text-brand)", padding: 0 } as React.CSSProperties,

  panel: { padding: "22px 24px", borderRadius: "var(--radius-xl)", border: "1px solid var(--glass-edge)", background: "var(--glass-2)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-rim), var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 16 } as React.CSSProperties,
  panelHead: { font: "700 14px var(--font-display)", color: "var(--text-strong)" } as React.CSSProperties,
  panelSub: { marginTop: 3, font: "400 12px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  form: { display: "flex", flexDirection: "column", gap: 16 } as React.CSSProperties,

  examples: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 9 } as React.CSSProperties,
  exBtn: { border: 0, background: "none", cursor: "pointer", font: "500 12px var(--font-body)", color: "var(--text-faint)", padding: 0, transition: "color var(--dur-base)" } as React.CSSProperties,
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 16px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" } as React.CSSProperties,
  toggleTitle: { font: "600 13px var(--font-body)", color: "var(--text-strong)" } as React.CSSProperties,
  toggleSub: { marginTop: 3, font: "400 12px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  trust: { textAlign: "center", marginTop: 14, font: "400 12px var(--font-body)", color: "var(--text-faint)" } as React.CSSProperties,
  advToggle: { border: 0, background: "none", cursor: "pointer", font: "600 12.5px var(--font-body)", color: "var(--text-brand)", padding: 0 } as React.CSSProperties,
  sectionRow: { display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  sunken: { padding: "14px 16px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 14 } as React.CSSProperties,
  uploadLabel: { font: "600 12px var(--font-body)", color: "var(--text-strong)", marginBottom: 8 } as React.CSSProperties,
  uploadHint: { font: "400 11px var(--font-body)", color: "var(--text-faint)" } as React.CSSProperties,
  dropZone: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", border: "1.5px dashed var(--border-default)", borderRadius: "var(--radius-md)", cursor: "pointer", font: "500 12.5px var(--font-body)", color: "var(--text-muted)", background: "var(--surface-sunken)" } as React.CSSProperties,
  logoRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)" } as React.CSSProperties,
  logoPreview: { width: 40, height: 40, borderRadius: 8, objectFit: "contain", background: "var(--ink-0)" } as React.CSSProperties,
  fileName: { flex: 1, font: "500 12px var(--font-body)", color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as React.CSSProperties,
  removeBtn: { border: 0, background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4 } as React.CSSProperties,
  thumbGrid: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 } as React.CSSProperties,
  thumbWrap: { position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-default)" } as React.CSSProperties,
  thumb: { width: "100%", height: "100%", objectFit: "cover", display: "block" } as React.CSSProperties,
  thumbX: { position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", border: 0, background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 } as React.CSSProperties,
  founderRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "start" } as React.CSSProperties,
  briefHint: { marginTop: 4, font: "400 11px var(--font-body)", color: "var(--text-faint)" } as React.CSSProperties,
  actions: { display: "flex", justifyContent: "flex-end", marginTop: 4 } as React.CSSProperties,
};

/**
 * Step transition. `custom` carries the direction into the exiting child too —
 * with mode="wait" the outgoing step renders after `dir` has already flipped,
 * so without it the exit would lean the wrong way.
 *
 * Reduced motion passes direction 0, which zeroes the travel and leaves a
 * short opacity fade: the change is still signalled, without movement.
 */
const stepVariants = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -28 }),
};

export default function NewProjectPage() {
  const navigate = useNavigate();
  // Two steps rather than one long scroll: pick the deck type, then fill in
  // only the fields that type actually needs.
  const [step, setStep] = useState<1 | 2>(1);
  // Which way the flow is moving, so the transition reads as forward or back
  // rather than as an unexplained swap. 1 = onward, -1 = returning.
  const [dir, setDir] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startNow, setStartNow] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      deckType: "investor",
      deckFormat: "presenter",
      brief: {},
      hasWebsite: true,
      companyUrl: "",
      name: "",
      founders: [{ name: "", role: "", oneLiner: "" }],
      startImmediately: true,
    },
  });

  // The deck-type catalogue comes from the backend registry, so the fields we
  // ask for are exactly the ones the generation prompt reads.
  const { data: deckTypes } = useQuery({
    queryKey: ["deck-types"],
    queryFn: deckTypesApi.list,
    staleTime: Infinity,
  });

  const deckType = watch("deckType");
  const deckFormat = watch("deckFormat");
  const selectedType: DeckTypeOption | undefined = useMemo(
    () => deckTypes?.find((d) => d.key === deckType),
    [deckTypes, deckType]
  );
  const runningOrder = useMemo(() => slideLabels(deckType), [deckType]);
  // Only investor decks vary their slide list by funding stage.
  const showsStage = !selectedType || selectedType.supportsStages;
  // A deck with no team slide has no reason to demand founder bios.
  const needsFounders = (DECK_TYPE_SECTIONS[deckType]?.sections ?? []).includes("team");

  // Switching type clears stale per-type answers and their errors.
  useEffect(() => {
    setValue("brief", {});
    clearErrors();
  }, [deckType, setValue, clearErrors]);

  // Moving between steps should start at the top of the new step.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

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
        deckType: data.deckType,
        brandingData: {
          // Deck-type answers ride alongside the shared fields; the pipeline
          // reads them straight out of branding_data as prompt ground truth.
          ...Object.fromEntries(
            Object.entries(data.brief || {}).filter(([, v]) => String(v ?? "").trim())
          ),
          deck_format: data.deckFormat,
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

  /**
   * Enforce what this deck type cannot be generated without.
   *
   * Kept out of the zod schema because the requirements come from the server
   * registry, not from anything the form knows statically. If the catalogue
   * hasn't loaded we let the request through and surface the backend's 422
   * rather than blocking on data we don't have.
   */
  const validateForDeckType = (data: FormData): boolean => {
    if (!selectedType) return true;
    let ok = true;

    for (const f of selectedType.briefFields) {
      if (f.required && !String(data.brief?.[f.name] ?? "").trim()) {
        setError(`brief.${f.name}` as never, { message: `${f.label} is required` });
        ok = false;
      }
    }

    if (!data.hasWebsite) {
      const required = new Set(selectedType.manualRequired);
      // Without a site to crawl there is no other source for the team, so a
      // deck that shows one needs the founders named here.
      if (needsFounders) { required.add("industry"); required.add("founders"); }

      for (const backendName of required) {
        const formName = SHARED_FIELD_FORM_NAMES[backendName];
        if (!formName) continue; // a brief field — already checked above
        if (formName === "founders") {
          if (!data.founders.length || !data.founders[0]?.name?.trim()) {
            setError("founders.0.name" as never, { message: "Add at least one founder" });
            ok = false;
          } else if (!data.founders[0]?.role?.trim()) {
            setError("founders.0.role" as never, { message: "Role is required" });
            ok = false;
          }
          continue;
        }
        if (!String((data as unknown as Record<string, unknown>)[formName] ?? "").trim()) {
          setError(formName as never, { message: "Required when there's no website to analyse" });
          ok = false;
        }
      }
    }

    if (!ok) toast.error("A few details are missing for this deck type");
    return ok;
  };

  const onSubmit = (data: FormData) => {
    data.startImmediately = startNow;
    if (!validateForDeckType(data)) return;
    createProject(data);
  };

  // ── Step indicator ────────────────────────────────────────────────────────
  const stepMarker = (n: 1 | 2, name: string, sub: string) => {
    const active = step === n;
    const done = step > n;
    return (
      <button
        type="button"
        style={ndS.stepBtn}
        onClick={() => { if (done) { setDir(-1); setStep(n); } }}
        aria-current={active ? "step" : undefined}
      >
        <span style={{ ...ndS.stepNum, ...(active || done ? ndS.stepNumOn : ndS.stepNumOff) }}>
          {done ? <Check size={13} /> : n}
        </span>
        <span>
          <span style={{ ...ndS.stepName, ...(active || done ? null : ndS.stepNameOff) }}>{name}</span>
          <div style={ndS.stepSub}>{sub}</div>
        </span>
      </button>
    );
  };

  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>
      <div style={ndS.page}>
        <Link to="/dashboard" style={ndS.back}>
          <ArrowLeft size={15} /> Dashboard
        </Link>

        <div style={ndS.steps}>
          {stepMarker(1, "Deck type", "Audience & structure")}
          <span style={ndS.stepBar} />
          {stepMarker(2, "Details", "Company & context")}
        </div>

        {/* One motion moment in the whole flow: moving between steps. The
            slide carries direction — forward leans left, Change leans right —
            so the swap is legible rather than instant. Springs are kept
            almost flat (bounce 0.15): this is a tool people raise money with,
            not a toy. */}
        <AnimatePresence mode="wait" initial={false} custom={reduceMotion ? 0 : dir}>
        <motion.div
          key={step}
          custom={reduceMotion ? 0 : dir}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : { type: "spring", bounce: 0.15, visualDuration: 0.3 }
          }
        >
        {step === 1 ? (
          /* ── Step 1: which deck ─────────────────────────────────────── */
          <>
            <div style={ndS.head}>
              <h1 style={ndS.h1}>Choose a deck type</h1>
              <p style={ndS.sub}>
                Each type has its own slide sequence and asks for different information.
                You can edit every slide afterwards.
              </p>
            </div>

            <div style={ndS.typeGrid}>
              {(deckTypes ?? []).map((t) => {
                const on = t.key === deckType;
                const Icon = TYPE_ICONS[t.key] ?? Layers;
                // Investor is the most common choice, so it leads the grid at
                // full width. Prominence only — the other six read the same.
                const wide = t.key === "investor";
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setValue("deckType", t.key, { shouldValidate: true })}
                    aria-pressed={on}
                    style={{ ...ndS.typeCard, ...(wide ? ndS.typeCardWide : null), ...(on ? ndS.typeCardOn : null) }}
                  >
                    {on && <span style={ndS.tick}><Check size={12} /></span>}
                    <div style={ndS.typeTop}>
                      <span style={{ ...ndS.typeIcon, ...(on ? null : ndS.typeIconOff) }}>
                        <Icon size={17} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <div style={ndS.typeName}>{t.label}</div>
                        <div style={ndS.typeDesc}>{t.description}</div>
                      </span>
                      {!on && <span style={ndS.typeCount}>{t.slideCount} slides</span>}
                    </div>
                    {/* Slide count as marks, so 8 vs 13 compares at a glance. */}
                    <div style={ndS.marks} aria-label={`${t.slideCount} slides`}>
                      {Array.from({ length: t.slideCount }, (_, i) => (
                        <span key={i} style={{ ...ndS.mark, ...(on ? ndS.markOn : null) }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedType && (
              <div style={ndS.order}>
                <div style={ndS.orderHead}>
                  <span style={ndS.orderTitle}>Slide running order</span>
                  <span style={ndS.orderMeta}>{runningOrder.length} slides</span>
                </div>
                <div style={ndS.chips}>
                  {runningOrder.map((label, i) => (
                    <span key={label + i} style={ndS.chip}>
                      <span style={ndS.chipNum}>{i + 1}</span>{label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={ndS.actions}>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => { setDir(1); setStep(2); }}
                iconRight={<ArrowRight size={16} />}
              >
                Continue to details
              </Button>
            </div>
          </>
        ) : (
          /* ── Step 2: the details that type needs ────────────────────── */
          <>
            <div style={ndS.head}>
              <h1 style={ndS.h1}>Tell us about the company</h1>
              <p style={ndS.sub}>
                {hasWebsite
                  ? "Drop in a company URL and we'll research the rest."
                  : "No website yet — the details you give us are all we'll use."}
              </p>
            </div>

            <div style={ndS.chosen}>
              <span style={ndS.typeIcon}>
                {(() => { const Icon = TYPE_ICONS[deckType] ?? Layers; return <Icon size={17} />; })()}
              </span>
              <span>
                <div style={ndS.chosenName}>{selectedType?.label ?? "Investor / Fundraising"}</div>
                <div style={ndS.chosenMeta}>{runningOrder.length} slides</div>
              </span>
              <button type="button" style={ndS.changeBtn} onClick={() => { setDir(-1); setStep(1); }}>Change</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} style={ndS.form}>
              {/* ── Company ─────────────────────────────────────────────── */}
              <div style={ndS.panel}>
                <div>
                  <div style={ndS.panelHead}>Company</div>
                  <div style={ndS.panelSub}>Where we start researching from.</div>
                </div>

                <div style={ndS.toggleRow}>
                  <div>
                    <div style={ndS.toggleTitle}>I don't have a website yet</div>
                    <div style={ndS.toggleSub}>New or idea-stage company — tell us about it instead</div>
                  </div>
                  <Switch checked={!hasWebsite} onChange={(v) => setValue("hasWebsite", !v, { shouldValidate: true })} />
                </div>

                {hasWebsite ? (
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
                        <button key={ex} type="button" style={ndS.exBtn}
                          onClick={() => setValue("companyUrl", "https://" + ex)}>
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={ndS.sunken}>
                    <div style={ndS.twoCol}>
                      <Input label="Company name" {...register("companyName")} placeholder="e.g. Zomato" error={errors.companyName?.message} />
                      <Input label="Industry" {...register("industry")} placeholder="e.g. Fintech, SaaS" error={errors.industry?.message} />
                    </div>
                    <Input
                      label="What problem are you solving?"
                      multiline rows={3}
                      {...register("problemStatement")}
                      placeholder="Who has this pain, and what does it cost them today?"
                      error={errors.problemStatement?.message}
                    />
                    <Input
                      label="What are you building?"
                      multiline rows={3}
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

                    {needsFounders && (
                      <div>
                        <div style={ndS.uploadLabel}>Founders</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {founderFields.map((field, i) => (
                            <div key={field.id} style={ndS.founderRow}>
                              <Input {...register(`founders.${i}.name` as const)} placeholder="Full name"
                                error={i === 0 ? errors.founders?.[0]?.name?.message : undefined} />
                              <Input {...register(`founders.${i}.role` as const)} placeholder="Role, e.g. Co-founder & CEO"
                                error={i === 0 ? errors.founders?.[0]?.role?.message : undefined} />
                              <Input {...register(`founders.${i}.oneLiner` as const)} placeholder="Background (optional), e.g. Ex-Google PM" />
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
                    )}

                    <Input
                      label="Early validation / traction"
                      hint="optional — e.g. waitlist signups, LOIs, pilot users"
                      multiline rows={2}
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
                )}
              </div>

              {/* ── About this deck ─────────────────────────────────────── */}
              <div style={ndS.panel}>
                <div>
                  <div style={ndS.panelHead}>About this deck</div>
                  <div style={ndS.panelSub}>
                    {selectedType?.briefFields.length
                      ? "Questions specific to the type you chose."
                      : "How this deck should be framed."}
                  </div>
                </div>

                <Input
                  label="Project name"
                  {...register("name")}
                  placeholder="e.g. Series A deck"
                  error={errors.name?.message}
                />

                {selectedType?.briefFields.map((f) => (
                  <div key={f.name}>
                    <Input
                      label={f.label}
                      hint={f.required ? undefined : "optional"}
                      multiline={f.type === "textarea"}
                      rows={f.type === "textarea" ? 3 : undefined}
                      type={f.type === "number" ? "number" : "text"}
                      placeholder={f.placeholder}
                      {...register(`brief.${f.name}` as const)}
                      error={(errors.brief as Record<string, { message?: string }> | undefined)?.[f.name]?.message}
                    />
                    {f.help && <div style={ndS.briefHint}>{f.help}</div>}
                  </div>
                ))}

                <div style={ndS.twoCol}>
                  {showsStage && (
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
                  )}
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

                <div style={ndS.toggleRow}>
                  <div>
                    <div style={ndS.toggleTitle}>Someone will present this</div>
                    <div style={ndS.toggleSub}>
                      {deckFormat === "presenter"
                        ? "Minimal text on slides, detail in the speaker notes"
                        : "Read on its own — fuller text so each slide explains itself"}
                    </div>
                  </div>
                  <Switch
                    checked={deckFormat === "presenter"}
                    onChange={(v) => setValue("deckFormat", v ? "presenter" : "standalone")}
                  />
                </div>
              </div>

              {/* ── Optional details ────────────────────────────────────── */}
              <div style={ndS.panel}>
                <div style={ndS.sectionRow}>
                  <div>
                    <div style={ndS.panelHead}>Numbers & branding</div>
                    <div style={ndS.panelSub}>Optional. Anything you give us is used exactly as entered.</div>
                  </div>
                  <button type="button" style={ndS.advToggle} onClick={() => setShowAdvanced((v) => !v)}>
                    {showAdvanced ? "Hide" : "Add details"}
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
                {isPending ? "Creating…" : "Create deck"}
              </Button>

              <p style={ndS.trust}>Takes about two minutes. Every slide is editable afterwards.</p>
            </form>
          </>
        )}
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
