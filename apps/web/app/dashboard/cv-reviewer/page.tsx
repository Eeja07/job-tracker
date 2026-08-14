"use client";
import { useState, useEffect, useRef } from "react";
import { applicationsApi, type Application } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, FileText, CheckCircle2, AlertTriangle, Lightbulb, RefreshCw, FileCode, Check, FileUp, X, Copy, Bot, Settings, Cpu, ExternalLink, KeyRound, Download, Link as LinkIcon } from "lucide-react";
import styles from "./page.module.css";

const DEFAULT_MASTER_CV = `Budiono Siregar
Senior Software Engineer | Full-Stack & DevOps Specialist
Email: budi@example.com | GitHub: github.com/budisiregar | LinkedIn: linkedin.com/in/budisiregar

RINGKASAN PROFIL:
Software Engineer berpengalaman 4+ tahun dalam membangun aplikasi web skala besar menggunakan TypeScript, Next.js, React, Node.js, NestJS, dan PostgreSQL. Terbiasa dengan arsitektur microservices, Docker, Redis, CI/CD pipelines, dan pengujian otomatis (Jest/Cypress).

KETERAMPILAN UTAMA (SKILLS):
- Frontend: React, Next.js (App Router), TypeScript, Tailwind CSS, Redux Toolkit, HTML5/CSS3
- Backend: Node.js, NestJS, Express, REST API, GraphQL, Prisma ORM, TypeORM
- Database & Cache: PostgreSQL, MySQL, Redis, MongoDB
- DevOps & Tools: Docker, Docker Compose, Git, CI/CD (GitHub Actions), Nginx, Linux Administration
- Testing & Architecture: Jest, TDD, Microservices, Clean Architecture, RBAC, JWT Auth

PENGALAMAN KERJA:
1. Senior Frontend Engineer — PT Tech Inovasi (2023 - Sekarang)
   - Mengembangkan dashboard analitik real-time menggunakan Next.js 14, TypeScript, dan WebSocket.
   - Meningkatkan performa aplikasi web hingga 40% melalui code-splitting dan image optimization.
2. Full Stack Developer — Digital Solusindo (2021 - 2023)
   - Membangun backend NestJS REST API dengan arsitektur microservices dan caching Redis.
   - Mengelola database PostgreSQL dengan Prisma ORM dan automatisasi migrasi DB.

PENDIDIKAN:
S1 Teknik Informatika — Universitas Indonesia (2017 - 2021)
`;

export default function CvReviewerPage() {
  const { user } = useAuth();
  const userId = user?.id || "";

  const [masterCv, setMasterCv] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [customRequirement, setCustomRequirement] = useState<string>("");
  const [parsingPdf, setParsingPdf] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [aiErrorNotice, setAiErrorNotice] = useState<string | null>(null);

  // AI Settings State: Retain ONLY Groq, OpenRouter, and Gemini
  type AiMode = "groq" | "openrouter" | "gemini";
  interface UserApiKeys {
    groq: string;
    openrouter: string;
    gemini: string;
  }

  const [aiMode, setAiMode] = useState<AiMode>("groq");
  const [apiKeys, setApiKeys] = useState<UserApiKeys>({ groq: "", openrouter: "", gemini: "" });
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [scrapeUrlInput, setScrapeUrlInput] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [showScrapeBox, setShowScrapeBox] = useState(false);

  const handleFetchJobFromUrl = async () => {
    const rawUrl = scrapeUrlInput.trim();
    if (!rawUrl) return;
    setFetchingUrl(true);
    try {
      const res = await applicationsApi.scrapeUrl(rawUrl);
      let reqText = `Target Posisi: ${res.jobTitle}\nPerusahaan: ${res.companyName}\n`;
      if (res.location) reqText += `Lokasi: ${res.location}\n`;
      reqText += `\nRequirements:\n${res.requirements}`;
      setCustomRequirement(reqText);
      setShowScrapeBox(false);
      setScrapeUrlInput("");
    } catch (err: any) {
      alert(err.message || "Gagal mengambil data dari URL");
    } finally {
      setFetchingUrl(false);
    }
  };

  const [analysisResult, setAnalysisResult] = useState<{
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    strengths?: string[];
    suggestions: string[];
    summary: string;
    executiveAnalysis?: string;
    tailoredSummaryDraft?: string;
    aiPowered?: boolean;
    providerName?: string;
  } | null>(null);

  const cvFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    const savedCv = localStorage.getItem(`master_cv_text_${userId}`);
    const savedFileName = localStorage.getItem(`master_cv_filename_${userId}`);
    const savedAiMode = localStorage.getItem(`ai_mode_${userId}`) as AiMode;

    let loadedKeys: UserApiKeys = { groq: "", openrouter: "", gemini: "" };

    const savedVaultRaw = localStorage.getItem(`api_vault_${userId}`);
    if (savedVaultRaw) {
      try {
        const vaultEntries = JSON.parse(savedVaultRaw);
        if (Array.isArray(vaultEntries)) {
          vaultEntries.forEach((entry: any) => {
            if (entry.isActive && entry.key && entry.provider in loadedKeys) {
              loadedKeys[entry.provider as keyof UserApiKeys] = entry.key;
            }
          });
        }
      } catch {}
    }

    const savedKeysRaw = localStorage.getItem(`ai_api_keys_${userId}`);
    if (savedKeysRaw) {
      try {
        const legacyKeys = JSON.parse(savedKeysRaw);
        if (!loadedKeys.groq && legacyKeys.groq) loadedKeys.groq = legacyKeys.groq;
        if (!loadedKeys.openrouter && legacyKeys.openrouter) loadedKeys.openrouter = legacyKeys.openrouter;
        if (!loadedKeys.gemini && legacyKeys.gemini) loadedKeys.gemini = legacyKeys.gemini;
      } catch {}
    } else {
      const oldKey = localStorage.getItem(`ai_api_key_${userId}`);
      if (oldKey && !loadedKeys.groq) loadedKeys.groq = oldKey;
    }

    setApiKeys(loadedKeys);
    setMasterCv(savedCv || DEFAULT_MASTER_CV);
    setCvFileName(savedFileName || "");
    if (savedAiMode && ["groq", "openrouter", "gemini"].includes(savedAiMode)) {
      setAiMode(savedAiMode);
    } else {
      setAiMode("groq");
    }

    applicationsApi.list({ limit: 50 }).then(res => {
      setApplications(res.data);
      const firstApp = res.data[0];
      if (firstApp) {
        setSelectedAppId(firstApp.id);
        if ((firstApp as any).requirements) {
          setCustomRequirement((firstApp as any).requirements);
        }
      }
    }).catch(() => { });
  }, [userId]);

  const saveCvText = (text: string, fileName?: string) => {
    setMasterCv(text);
    if (userId) {
      localStorage.setItem(`master_cv_text_${userId}`, text);
      if (fileName !== undefined) {
        setCvFileName(fileName);
        localStorage.setItem(`master_cv_filename_${userId}`, fileName);
      }
    }
  };

  const updateProviderKey = (provider: AiMode, keyVal: string) => {
    const updated = { ...apiKeys, [provider]: keyVal };
    setApiKeys(updated);
    if (userId) {
      localStorage.setItem(`ai_api_keys_${userId}`, JSON.stringify(updated));

      // Sync into api_vault_${userId}
      const savedVaultRaw = localStorage.getItem(`api_vault_${userId}`);
      let vaultEntries: any[] = [];
      if (savedVaultRaw) {
        try { vaultEntries = JSON.parse(savedVaultRaw); } catch {}
      }
      const existingIdx = vaultEntries.findIndex((e: any) => e.provider === provider && e.isActive);
      if (existingIdx !== -1) {
        vaultEntries[existingIdx].key = keyVal;
      } else if (keyVal.trim()) {
        vaultEntries.unshift({
          id: "key_" + Date.now(),
          name: `${provider.toUpperCase()} Key`,
          provider,
          key: keyVal.trim(),
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }
      localStorage.setItem(`api_vault_${userId}`, JSON.stringify(vaultEntries));
    }
  };

  const updateAiMode = (mode: AiMode) => {
    setAiMode(mode);
    if (userId) {
      localStorage.setItem(`ai_mode_${userId}`, mode);
    }
  };

  const handleFileUpload = async (file: File) => {
    setParsingPdf(true);
    try {
      let extractedText = "";
      if (file.name.endsWith(".pdf")) {
        try {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let pagesText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(" ");
            pagesText += pageText + "\n\n";
          }
          extractedText = pagesText.trim();
        } catch {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let str = "";
          for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            if (b !== undefined) str += String.fromCharCode(b);
          }
          const matches = str.match(/[\x20-\x7E\s]{4,}/g) || [];
          extractedText = matches.join(" ").replace(/\s+/g, " ");
        }
      } else {
        extractedText = await file.text();
      }

      if (extractedText.trim().length > 10) {
        saveCvText(extractedText, file.name);
      } else {
        alert("Gagal membaca teks dari PDF. Menggunakan draf teks CV.");
      }
    } catch {
      alert("Gagal mengimpor file PDF. Menggunakan teks draf CV.");
    } finally {
      setParsingPdf(false);
    }
  };

  const handleSelectApp = (appId: string) => {
    setSelectedAppId(appId);
    const app = applications.find(a => a.id === appId);
    if (app) {
      const req = (app as any).requirements || `Lowongan: ${app.jobTitle} di ${app.company?.name || 'Perusahaan'}\nLokasi: ${app.location || 'Remote'}\nKualifikasi:\n- Membutuhkan kemampuan ${app.jobTitle}\n- Pengalaman teknologi terkait web development\n- Kemampuan problem solving & komunikasi yang baik.`;
      setCustomRequirement(req);
    }
  };

  const generateFullAiPrompt = () => {
    return `Act as a Senior Executive Tech Recruiter & ATS Optimization Specialist.
Perform a rigorous, professional evaluation of the Candidate's Master CV against the Target Job Requirements below.

=== TARGET JOB REQUIREMENTS ===
${customRequirement || "Software Engineer / Technical Role at top tech company"}

=== CANDIDATE MASTER CV ===
${masterCv}

EVALUATION INSTRUCTIONS:
1. ALL OUTPUT MUST BE IN HIGH-QUALITY PROFESSIONAL ENGLISH (tailored for global & top tech company standards such as Google).
2. Calculate a realistic ATS Match Score (0 - 100) based on hard skills, tech stack, and role fit.
3. Extract matched technical skills/keywords (matchedKeywords) in UPPERCASE.
4. Identify missing critical technical skills/keywords (missingKeywords) in UPPERCASE.
5. Provide 3-4 key candidate strengths (strengths) written in clear English.
6. Provide 3-5 specific, actionable CV improvement recommendations (suggestions) written in clear English.
7. Provide a concise, 2-3 sentence executive assessment summary (summary).

RESPOND ONLY IN VALID JSON FORMAT (NO MARKDOWN WRAPPERS OR OTHER TEXT OUTSIDE JSON):
{
  "score": number,
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "strengths": ["string"],
  "suggestions": ["string"],
  "summary": "string"
}`;
  };

  const copyAiPromptToClipboard = () => {
    const prompt = generateFullAiPrompt();
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const runAnalysis = async () => {
    if (!masterCv.trim()) { alert("Silakan isi atau upload PDF Master CV terlebih dahulu"); return; }
    if (!customRequirement.trim()) { alert("Silakan isi kualifikasi / requirements lowongan yang ingin di-review"); return; }

    setAnalyzing(true);
    setAnalysisResult(null);
    setAiErrorNotice(null);

    const userKey = (apiKeys[aiMode] || "").trim();

    // 1. GROQ CLOUD EXECUTION (100% Free Tier)
    if (aiMode === "groq") {
      if (!userKey) {
        setAiErrorNotice("API Key Groq belum diisi. Silakan buka menu 'Pengaturan AI' atau 'API Keys Vault' untuk memasukkan API Key Groq Anda.");
        setShowAiSettings(true);
        setAnalyzing(false);
        return;
      }
      const groqModels = [
        "openai/gpt-oss-20b",
        "qwen-2.5-coder-32b",
        "llama-3.3-70b-versatile"
      ];
      let groqErrorMsg = "";
      for (const model of groqModels) {
        try {
          const isDeepSeek = model.includes("deepseek");
          const bodyPayload: any = {
            model,
            messages: [
              { role: "system", content: "You are a Senior Tech Recruiter & ATS Expert. Respond ONLY in valid JSON format using professional English." },
              { role: "user", content: generateFullAiPrompt() }
            ]
          };

          if (!isDeepSeek) {
            bodyPayload.response_format = { type: "json_object" };
          }

          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${userKey}`
            },
            body: JSON.stringify(bodyPayload)
          });

          if (response.ok) {
            const data = await response.json();
            const rawText = data.choices[0].message.content || "";
            const cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json|```/gi, "").trim();
            const firstBrace = cleanText.indexOf("{");
            const lastBrace = cleanText.lastIndexOf("}");
            const jsonString = firstBrace !== -1 && lastBrace !== -1 ? cleanText.substring(firstBrace, lastBrace + 1) : cleanText;
            const content = JSON.parse(jsonString);

            setAnalysisResult({
              score: content.score ?? 85,
              matchedKeywords: content.matchedKeywords ?? [],
              missingKeywords: content.missingKeywords ?? [],
              strengths: content.strengths ?? [],
              suggestions: content.suggestions ?? [],
              summary: content.summary ?? `Review Groq AI (${model}) telah selesai.`,
              executiveAnalysis: content.executiveAnalysis ?? "",
              tailoredSummaryDraft: content.tailoredSummaryDraft ?? "",
              aiPowered: true,
              providerName: `Groq Cloud (${model})`
            });
            setAnalyzing(false);
            return;
          } else {
            const errData = await response.json().catch(() => ({}));
            groqErrorMsg = errData.error?.message || `HTTP ${response.status}`;
          }
        } catch (e: any) {
          groqErrorMsg = e.message || String(e);
        }
      }
      setAiErrorNotice(`Groq API Error: ${groqErrorMsg || "Periksa API Key Groq Anda"}. Coba gunakan OpenRouter Free Tier.`);
      setAnalyzing(false);
      return;
    }

    // 2. OPENROUTER FREE TIER EXECUTION
    if (aiMode === "openrouter") {
      if (!userKey) {
        setAiErrorNotice("API Key OpenRouter belum diisi. Silakan buka menu 'Pengaturan AI' atau 'API Keys Vault' untuk memasukkan API Key OpenRouter Anda.");
        setShowAiSettings(true);
        setAnalyzing(false);
        return;
      }
      const openRouterModels = [
        "openrouter/auto",
        "deepseek/deepseek-r1:free",
        "deepseek/deepseek-chat:free",
        "qwen/qwen-2.5-coder-32b-instruct:free"
      ];
      let openRouterErrMsg = "";
      for (const model of openRouterModels) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${userKey}`,
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "Job Tracker CV Reviewer",
              "X-OpenRouter-Title": "Job Tracker CV Reviewer"
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: "Anda adalah Senior HR Recruiter AI. WAJIB menjawab HANYA dalam Bahasa Indonesia profesional dan format JSON murni." },
                { role: "user", content: generateFullAiPrompt() }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const rawText = data.choices[0].message.content || "";
            const cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json|```/gi, "").trim();
            const firstBrace = cleanText.indexOf("{");
            const lastBrace = cleanText.lastIndexOf("}");
            const jsonString = firstBrace !== -1 && lastBrace !== -1 ? cleanText.substring(firstBrace, lastBrace + 1) : cleanText;
            const content = JSON.parse(jsonString);
            setAnalysisResult({
              score: content.score ?? 85,
              matchedKeywords: content.matchedKeywords ?? [],
              missingKeywords: content.missingKeywords ?? [],
              strengths: content.strengths ?? [],
              suggestions: content.suggestions ?? [],
              summary: content.summary ?? `Review OpenRouter Free (${model}) telah selesai.`,
              executiveAnalysis: content.executiveAnalysis ?? "",
              tailoredSummaryDraft: content.tailoredSummaryDraft ?? "",
              aiPowered: true,
              providerName: `OpenRouter (${model})`
            });
            setAnalyzing(false);
            return;
          } else {
            const errData = await response.json().catch(() => ({}));
            openRouterErrMsg = errData.error?.message || `HTTP ${response.status}`;
          }
        } catch (e: any) {
          openRouterErrMsg = e.message || String(e);
        }
      }
      setAiErrorNotice(`OpenRouter API Error: ${openRouterErrMsg || "Periksa API Key OpenRouter Anda"}.`);
      setAnalyzing(false);
      return;
    }

    // 3. GEMINI GOOGLE AI STUDIO EXECUTION
    if (aiMode === "gemini") {
      if (!userKey) {
        setAiErrorNotice("API Key Gemini belum diisi. Silakan buka menu 'Pengaturan AI' atau 'API Keys Vault' untuk memasukkan API Key Gemini Anda.");
        setShowAiSettings(true);
        setAnalyzing(false);
        return;
      }
      const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

      for (const model of geminiModels) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: generateFullAiPrompt() }] }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const cleanJson = rawText.replace(/```json|```/g, "").trim();
            const content = JSON.parse(cleanJson);
            setAnalysisResult({
              score: content.score ?? 85,
              matchedKeywords: content.matchedKeywords ?? [],
              missingKeywords: content.missingKeywords ?? [],
              strengths: content.strengths ?? [],
              suggestions: content.suggestions ?? [],
              summary: content.summary ?? `Review AI Google Gemini (${model}) telah selesai.`,
              executiveAnalysis: content.executiveAnalysis ?? "",
              tailoredSummaryDraft: content.tailoredSummaryDraft ?? "",
              aiPowered: true,
              providerName: `Google Gemini (${model})`
            });
            setAnalyzing(false);
            return;
          }
        } catch { }
      }

      setAiErrorNotice(`API Key Gemini tidak valid atau batas kuota terlampaui. Silakan ganti API Key atau gunakan Groq Cloud / OpenRouter gratis.`);
      setAnalyzing(false);
      return;
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Master CV & AI Reviewer</h1>
          <p className={styles.subtitle}>
            Review CV Anda menggunakan Real AI LLM (Groq Cloud, OpenRouter, atau Google Gemini AI).
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button className={styles.secondaryBtn} onClick={() => setShowAiSettings(!showAiSettings)}>
            <Settings size={15} />
            <span>Pengaturan AI</span>
          </button>
          <button className={styles.copyPromptBtn} onClick={copyAiPromptToClipboard} title="Salin Prompt Siap Pakai ke ChatGPT/Gemini">
            <Copy size={15} />
            <span>{copiedPrompt ? "Disalin!" : "Salin Prompt AI"}</span>
          </button>
        </div>
      </div>

      {aiErrorNotice && (
        <div className={styles.errorNoticeBox}>
          <AlertTriangle size={16} />
          <span>{aiErrorNotice}</span>
        </div>
      )}

      {/* AI Settings Box */}
      {showAiSettings && (
        <div className={styles.aiSettingsBox}>
          <div className={styles.aiSettingsHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Cpu size={16} />
              <strong>Pengaturan API Key LLM ({aiMode.toUpperCase()})</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <a
                href="/dashboard/api-keys"
                style={{ fontSize: "0.75rem", color: "var(--text)", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <KeyRound size={12} /> Buka API Keys Vault
              </a>
              <button className={styles.clearFileBtn} onClick={() => setShowAiSettings(false)}><X size={14} /></button>
            </div>
          </div>

          <div className={styles.aiSettingsGrid}>
            <div className={styles.selectAppRow}>
              <label className={styles.label}>PILIH ENGINE REVIEWER:</label>
              <select
                className={styles.selectInput}
                value={aiMode}
                onChange={e => updateAiMode(e.target.value as AiMode)}
              >
                <option value="groq">Groq Cloud (GPT-OSS 20B, Qwen 2.5 32B, Llama 3.3 70B)</option>
                <option value="openrouter">OpenRouter Free Tier (DeepSeek R1, DeepSeek V3, Qwen 2.5)</option>
                <option value="gemini">Google Gemini AI (Gemini 2.0 Flash / Pro)</option>
              </select>
            </div>

            <div className={styles.selectAppRow}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className={styles.label}>API KEY / TOKEN {aiMode.toUpperCase()}:</label>
                {aiMode === "groq" && (
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "2px" }}
                  >
                    Ambil Groq Key Gratis <ExternalLink size={10} />
                  </a>
                )}
                {aiMode === "openrouter" && (
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "2px" }}
                  >
                    Ambil OpenRouter Key Gratis <ExternalLink size={10} />
                  </a>
                )}
                {aiMode === "gemini" && (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "2px" }}
                  >
                    Ambil Gemini Key Gratis <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <input
                type="password"
                className={styles.selectInput}
                value={apiKeys[aiMode] || ""}
                onChange={e => updateProviderKey(aiMode, e.target.value)}
                placeholder={`Masukkan API Key ${aiMode.toUpperCase()}...`}
              />
            </div>
          </div>
        </div>
      )}

      <div className={styles.grid2}>
        {/* Column 1: Master CV Editor & File Upload */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <FileCode size={18} />
              <h2 className={styles.cardTitle}>CV Utama (PDF & Teks)</h2>
            </div>
            <button
              className={styles.resetBtn}
              onClick={() => saveCvText(DEFAULT_MASTER_CV, "")}
              title="Gunakan Contoh Template CV"
            >
              Gunakan Contoh Template
            </button>
          </div>

          <input
            type="file"
            ref={cvFileInputRef}
            style={{ display: "none" }}
            accept=".pdf,.txt"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
          />

          <div className={styles.uploadBox} onClick={() => cvFileInputRef.current?.click()}>
            {parsingPdf ? (
              <div className={styles.parsingRow}>
                <RefreshCw size={18} className={styles.spinner} />
                <span>Mengekstrak teks dari PDF CV...</span>
              </div>
            ) : (
              <>
                <FileUp size={22} className={styles.uploadIcon} />
                <span className={styles.uploadText}>
                  <strong>Klik untuk Upload File PDF CV</strong> dari komputer Anda
                </span>
                <span className={styles.uploadSubtext}>Mendukung format PDF & TXT. Teks akan diekstrak otomatis.</span>
              </>
            )}
          </div>

          {cvFileName && (
            <div className={styles.fileBadge}>
              <FileText size={14} />
              <span>Terimpor dari: <strong>{cvFileName}</strong></span>
              <button
                type="button"
                className={styles.clearFileBtn}
                onClick={() => saveCvText(masterCv, "")}
                title="Hapus rujukan file"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <p className={styles.cardHint}>
            Teks hasil ekstraksi PDF CV atau draf manual tersimpan otomatis:
          </p>
          <textarea
            className={styles.cvTextarea}
            value={masterCv}
            onChange={e => saveCvText(e.target.value)}
            placeholder="Paste atau upload file PDF CV Anda di sini..."
            rows={14}
          />
        </div>

        {/* Column 2: Job Requirements & Review Result */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleWrap}>
                <FileText size={18} />
                <h2 className={styles.cardTitle}>Target Kualifikasi / Lowongan</h2>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                onClick={() => setShowScrapeBox(!showScrapeBox)}
              >
                <Download size={13} />
                <span>Import dari Link URL</span>
              </button>
            </div>

            {showScrapeBox && (
              <div style={{ display: "flex", gap: "0.5rem", background: "var(--bg-subtle)", padding: "0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <input
                  type="url"
                  className={styles.selectInput}
                  style={{ flex: 1, fontSize: "0.85rem" }}
                  placeholder="Paste URL Jobstreet / Glints / LinkedIn..."
                  value={scrapeUrlInput}
                  onChange={e => setScrapeUrlInput(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.primaryBtn}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                  onClick={handleFetchJobFromUrl}
                  disabled={fetchingUrl || !scrapeUrlInput.trim()}
                >
                  {fetchingUrl ? <RefreshCw size={13} className={styles.spinner} /> : <Download size={13} />}
                  <span>{fetchingUrl ? "Mengambil..." : "Import"}</span>
                </button>
              </div>
            )}

            {applications.length > 0 && (
              <div className={styles.selectAppRow}>
                <label className={styles.label}>Pilih Lamaran Tersimpan:</label>
                <select
                  className={styles.selectInput}
                  value={selectedAppId}
                  onChange={e => handleSelectApp(e.target.value)}
                >
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.jobTitle} — {app.company?.name || 'Perusahaan'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <textarea
              className={styles.reqTextarea}
              value={customRequirement}
              onChange={e => setCustomRequirement(e.target.value)}
              placeholder="Paste kualifikasi / persyaratan lowongan kerja di sini...&#10;- Minimal 3 tahun React & TypeScript&#10;- Pengalaman Docker & PostgreSQL"
              rows={5}
            />

            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button className={styles.primaryBtn} onClick={runAnalysis} disabled={analyzing || parsingPdf} style={{ flex: 1 }}>
                {analyzing ? <RefreshCw size={15} className={styles.spinner} /> : <Bot size={15} />}
                <span>{analyzing ? "Menganalisis..." : "Review CV"}</span>
              </button>
            </div>
          </div>

          {/* Analysis Results Card */}
          {analysisResult && (
            <div className={styles.resultCard}>
              <div className={styles.scoreRow}>
                <div className={styles.scoreCircle}>
                  <span className={styles.scoreVal}>{analysisResult.score}%</span>
                  <span className={styles.scoreLabel}>Match Score</span>
                </div>
                <div className={styles.scoreMeta}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 className={styles.scoreTitle}>
                      {analysisResult.score >= 80 ? "Sangat Cocok (High ATS Match)" : analysisResult.score >= 60 ? "Cukup Cocok (Moderate Match)" : "Perlu Dioptimasi"}
                    </h3>
                    {analysisResult.providerName && (
                      <span className={styles.aiTag}>
                        <Sparkles size={9} /> {analysisResult.providerName}
                      </span>
                    )}
                  </div>
                  <p className={styles.scoreSummary}>{analysisResult.summary}</p>
                </div>
              </div>

              {analysisResult.matchedKeywords.length > 0 && (
                <div className={styles.kwSection}>
                  <h4 className={styles.kwTitle}>
                    <CheckCircle2 size={15} /> Kata Kunci & Skill yang Cocok ({analysisResult.matchedKeywords.length})
                  </h4>
                  <div className={styles.badgeWrap}>
                    {analysisResult.matchedKeywords.map((kw, i) => (
                      <span key={i} className={styles.matchedBadge}>
                        <Check size={12} /> {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.missingKeywords.length > 0 && (
                <div className={styles.kwSection}>
                  <h4 className={styles.kwTitle}>
                    <AlertTriangle size={15} /> Kata Kunci yang Masih Kurang ({analysisResult.missingKeywords.length})
                  </h4>
                  <div className={styles.badgeWrap}>
                    {analysisResult.missingKeywords.map((kw, i) => (
                      <span key={i} className={styles.missingBadge}>
                        + {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                <div className={styles.kwSection}>
                  <h4 className={styles.kwTitle}>
                    <CheckCircle2 size={15} /> Kelebihan & Poin Kuat CV Anda ({analysisResult.strengths.length})
                  </h4>
                  <ul className={styles.tipsList}>
                    {analysisResult.strengths.map((str, i) => (
                      <li key={i}>
                        {str}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={styles.kwSection}>
                <h4 className={styles.kwTitle}>
                  <Lightbulb size={15} /> Rekomendasi & Langkah Perbaikan Konkret
                </h4>
                <ul className={styles.tipsList}>
                  {analysisResult.suggestions.map((sug, i) => (
                    <li key={i}>
                      <strong>Poin {i + 1}:</strong> {sug}
                    </li>
                  ))}
                </ul>
              </div>

              {analysisResult.executiveAnalysis && (
                <div className={styles.kwSection}>
                  <h4 className={styles.kwTitle}>
                    <Bot size={15} /> Analisis Eksekutif Recruiter & Hiring Manager
                  </h4>
                  <div className={styles.boxText}>
                    {analysisResult.executiveAnalysis}
                  </div>
                </div>
              )}

              {analysisResult.tailoredSummaryDraft && (
                <div className={styles.kwSection}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h4 className={styles.kwTitle}>
                      <Sparkles size={15} /> Draf Profile Summary Ter-tailor Posisi Ini
                    </h4>
                    <button
                      className={styles.copyPromptBtn}
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                      onClick={() => {
                        navigator.clipboard.writeText(analysisResult.tailoredSummaryDraft!);
                        alert("Draf Profile Summary berhasil disalin ke clipboard!");
                      }}
                    >
                      <Copy size={12} /> Salin Summary
                    </button>
                  </div>
                  <div className={styles.boxText} style={{ fontStyle: "italic" }}>
                    "{analysisResult.tailoredSummaryDraft}"
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
