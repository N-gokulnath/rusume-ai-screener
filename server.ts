import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import mammoth from "mammoth";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { ScreenedCandidate, JobDescriptionData } from "./src/types.js";

// Lazy-initialized Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// In-Memory Database Store for Session & Users
interface UserProfile {
  email: string;
  name?: string;
  passwordHash: string;
}

interface UserStore {
  candidatesDb: ScreenedCandidate[];
  activeJobDescription: JobDescriptionData;
}

const usersDb: UserProfile[] = [
  {
    email: "demo@rankflow.ai",
    name: "Demo Recruiter",
    passwordHash: "demo123"
  }
];

const userStores: Record<string, UserStore> = {
  "demo@rankflow.ai": {
    candidatesDb: [],
    activeJobDescription: { text: "", title: "" }
  }
};

function getUserStore(email: string): UserStore {
  if (!userStores[email]) {
    userStores[email] = {
      candidatesDb: [],
      activeJobDescription: { text: "", title: "" }
    };
  }
  return userStores[email];
}

function getAuthenticatedUser(req: any): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  if (token.startsWith("token_for_")) {
    const email = token.replace("token_for_", "");
    const exists = usersDb.some((u) => u.email === email);
    if (exists) {
      return email;
    }
  }
  return null;
}

// Helper to compute rankings dynamically
function computeRanks(candidates: ScreenedCandidate[]): ScreenedCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.matchScore - a.matchScore);
  return candidates.map((c) => {
    const rIdx = sorted.findIndex((s) => s.id === c.id);
    return {
      ...c,
      rank: rIdx !== -1 ? rIdx + 1 : undefined,
    };
  });
}

// Helper to extract text from files
async function extractTextFromFile(file: Express.Multer.File): Promise<{ text: string; error?: string }> {
  const originalName = file.originalname.toLowerCase();
  const mime = file.mimetype;

  try {
    if (mime === "text/plain" || originalName.endsWith(".txt")) {
      return { text: file.buffer.toString("utf-8") };
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      originalName.endsWith(".docx")
    ) {
      const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
      return { text: docxResult.value };
    } else if (originalName.endsWith(".doc")) {
      // Basic text extraction for older DOC format if docx conversion is bypassed
      const text = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\t\r\n]/g, " ");
      return { text };
    } else if (mime === "application/pdf" || originalName.endsWith(".pdf")) {
      return { text: "[PDF Binary Content - Evaluated with native AI reader]" };
    } else {
      // Fallback text dump
      return { text: file.buffer.toString("utf-8") };
    }
  } catch (err: any) {
    return { text: "", error: `Failed to extract text from ${file.originalname}: ${err.message}` };
  }
}

// AI evaluation model for single resume
async function evaluateResumeWithAI(
  file: Express.Multer.File,
  jdText: string
): Promise<ScreenedCandidate> {
  const uuid = Math.random().toString(36).substring(2, 11);
  const originalName = file.originalname;
  const isPdf = file.mimetype === "application/pdf" || originalName.toLowerCase().endsWith(".pdf");

  let contentParts: any[] = [];

  if (isPdf) {
    // Pass binary representation natively to Gemini PDF parser
    contentParts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: file.buffer.toString("base64"),
      },
    });

    contentParts.push({
      text: `Carefully parse the attached resume PDF document and screen it against the following Job Description.

Job Description / Role Criteria:
${jdText}

Evaluate and return the structured screening metrics in the requested JSON scheme. Ensure you perform a sincere, accurate matching score assessment based on experience, educations, keywords, and skills match.`,
    });
  } else {
    // Extract text from raw string or DOCX
    const extracted = await extractTextFromFile(file);
    if (extracted.error) {
      throw new Error(extracted.error);
    }

    contentParts.push({
      text: `Carefully parse the following Candidate Resume Text and screen it against the Job Description.

Job Description / Role Criteria:
${jdText}

Candidate Resume Text Content:
${extracted.text}

Evaluate and return the structured screening metrics in the requested JSON scheme. Ensure you perform a sincere, accurate matching score assessment based on experience, educations, keywords, and skills match.`,
    });
  }

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: contentParts,
    config: {
      systemInstruction:
        "You are an expert HR automated talent screening analyst. Assess the resume against the job description with balanced, consistent, and highly critical HR standards. Generate scores in 0-100 range. When evaluating education and experience, output objective rationales. Format output strictly in JSON according to responseSchema.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Candidate's full name extracted from the resume. Fallback to file name without extensions if not found.",
          },
          email: {
            type: Type.STRING,
            description: "Candidate's email. Empty string if not found.",
          },
          phone: {
            type: Type.STRING,
            description: "Candidate's contact phone. Empty string if not found.",
          },
          matchScore: {
            type: Type.NUMBER,
            description: "Overall screening match score from 0 to 100 based on fit to the job description.",
          },
          matchingSkills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Subset of skills relevant to the job criteria found in candidate's resume.",
          },
          missingSkills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key skills explicitly required by the Job Description that this candidate lacks.",
          },
          experienceRelevance: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Experience alignment score from 0 to 100." },
              summary: { type: Type.STRING, description: "Review of experience duration, seniority level, and previous role relevance." },
            },
            required: ["score", "summary"],
          },
          educationAlignment: {
            type: Type.OBJECT,
            properties: {
              status: {
                type: Type.STRING,
                description: "Must be exactly 'aligned' (meets/exceeds degree), 'partially' (similar major, slightly lower degree), or 'not_aligned'.",
              },
              summary: { type: Type.STRING, description: "Review of qualifications, certifications, academic credentials." },
            },
            required: ["status", "summary"],
          },
          keyStrengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Top 3 standout capabilities or accomplishments of this candidate that fit the target role.",
          },
          overallSummary: {
            type: Type.STRING,
            description: "Constructive HR screening rationale outlining why this score was assigned and cultural or functional highlights.",
          },
        },
        required: [
          "name",
          "email",
          "phone",
          "matchScore",
          "matchingSkills",
          "missingSkills",
          "experienceRelevance",
          "educationAlignment",
          "keyStrengths",
          "overallSummary",
        ],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No screening report returned from Gemini.");
  }

  const parsedData = JSON.parse(responseText.trim());

  let parsedText = "[PDF Resume Content]";
  if (!isPdf) {
    const extracted = await extractTextFromFile(file);
    parsedText = extracted.text;
  } else {
    parsedText = `[PDF Native File: ${originalName}] Native parsing completed successfully via Gemini 3.5. You can view matching criteria and strengths in the detail screen.`;
  }

  return {
    id: uuid,
    name: parsedData.name || originalName.split(".")[0] || "Unknown Candidate",
    email: parsedData.email || "",
    phone: parsedData.phone || "",
    fileName: originalName,
    matchScore: Math.round(parsedData.matchScore || 0),
    matchingSkills: parsedData.matchingSkills || [],
    missingSkills: parsedData.missingSkills || [],
    experienceRelevance: {
      score: Math.round(parsedData.experienceRelevance?.score || 0),
      summary: parsedData.experienceRelevance?.summary || "No review available.",
    },
    educationAlignment: {
      status: parsedData.educationAlignment?.status || "not_aligned",
      summary: parsedData.educationAlignment?.summary || "No certification details found.",
    },
    keyStrengths: parsedData.keyStrengths || [],
    overallSummary: parsedData.overallSummary || "",
    parsedText: parsedText,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Setup Multer
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 }, // 12MB limit
  });

  // API REST endpoints

  // A. AUTHENTICATION SERVICE ENDPOINTS
  app.post("/api/auth/signup", (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required credentials." });
      }
      const trimmedEmail = email.trim().toLowerCase();
      const exists = usersDb.some((u) => u.email === trimmedEmail);
      if (exists) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }
      const newUser = { email: trimmedEmail, name: name || trimmedEmail.split("@")[0], passwordHash: password };
      usersDb.push(newUser);
      
      // Initialize an isolated user store
      getUserStore(trimmedEmail);
      
      return res.json({
        success: true,
        token: `token_for_${trimmedEmail}`,
        user: { email: trimmedEmail, name: newUser.name }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required credentials." });
      }
      const trimmedEmail = email.trim().toLowerCase();
      const user = usersDb.find((u) => u.email === trimmedEmail && u.passwordHash === password);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password combination." });
      }
      return res.json({
        success: true,
        token: `token_for_${trimmedEmail}`,
        user: { email: trimmedEmail, name: user.name }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const email = getAuthenticatedUser(req);
    if (!email) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = usersDb.find((u) => u.email === email);
    return res.json({
      user: { email, name: user?.name || email.split("@")[0] }
    });
  });

  // B. CANDIDATE & SCREENING ENDPOINTS (SECURED)

  // 1. Fetch current screening DB status
  app.get("/api/candidates", (req, res) => {
    try {
      const email = getAuthenticatedUser(req);
      if (!email) {
        return res.status(401).json({ error: "Authorization required. Please log in first." });
      }
      const store = getUserStore(email);
      const sortedResult = computeRanks(store.candidatesDb);
      res.json({
        candidates: sortedResult,
        jobDescription: store.activeJobDescription,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. Perform screening and scoring
  app.post(
    "/api/screen",
    upload.fields([
      { name: "resumes", maxCount: 20 },
      { name: "jobDescriptionFile", maxCount: 1 },
    ]),
    async (req: any, res: any) => {
      try {
        const email = getAuthenticatedUser(req);
        if (!email) {
          return res.status(401).json({ error: "Authentication required to run screening pipeline." });
        }
        const store = getUserStore(email);

        let jobDescriptionText = req.body.jobDescriptionText || "";
        let append = req.body.append === "true";

        // Try parsing JD file if uploaded
        if (req.files && req.files["jobDescriptionFile"]) {
          const jdFile = req.files["jobDescriptionFile"][0];
          if (jdFile.mimetype === "application/pdf" || jdFile.originalname.toLowerCase().endsWith(".pdf")) {
            const extracted = await extractTextFromFile(jdFile);
            jobDescriptionText = extracted.text !== "[PDF Binary Content - Evaluated with native AI reader]" ? extracted.text : `Automated job target based on document. See file ${jdFile.originalname}`;
          } else {
            const extracted = await extractTextFromFile(jdFile);
            jobDescriptionText = extracted.text;
          }
          store.activeJobDescription.title = jdFile.originalname;
        }

        if (!jobDescriptionText || jobDescriptionText.trim().length === 0) {
          if (store.activeJobDescription.text) {
            jobDescriptionText = store.activeJobDescription.text;
          } else {
            return res.status(400).json({ error: "Please enter a Job Description or upload a JD document. This is required to screen candidate resumes." });
          }
        }

        // Update active job description
        store.activeJobDescription.text = jobDescriptionText;
        if (req.body.jobDescriptionTitle) {
          store.activeJobDescription.title = req.body.jobDescriptionTitle;
        } else if (!store.activeJobDescription.title) {
          store.activeJobDescription.title = jobDescriptionText.substring(0, 35).trim() + "...";
        }

        // Get resumes
        const resumeFiles = (req.files && req.files["resumes"]) || [];
        if (resumeFiles.length === 0 && !append) {
          if (!append) {
            store.candidatesDb = [];
          }
          return res.json({
            candidates: [],
            jobDescription: store.activeJobDescription,
            message: "Job description updated successfully.",
          });
        }

        // Wipe old DB if not appending
        if (!append) {
          store.candidatesDb = [];
        }

        // Run screening of files in parallel
        const results = await Promise.all(
          resumeFiles.map(async (file: Express.Multer.File) => {
            try {
              return await evaluateResumeWithAI(file, jobDescriptionText);
            } catch (err: any) {
              console.error(`Error screening resume ${file.originalname}:`, err);
              return {
                id: Math.random().toString(36).substring(2, 11),
                name: file.originalname.split(".")[0],
                email: "",
                phone: "",
                fileName: file.originalname,
                matchScore: 0,
                matchingSkills: [],
                missingSkills: [],
                experienceRelevance: { score: 0, summary: "Failed screening." },
                educationAlignment: { status: "not_aligned", summary: "Failed screening." },
                keyStrengths: [],
                overallSummary: "",
                error: `Failed to screen this resume: ${err.message}`,
              } as ScreenedCandidate;
            }
          })
        );

        // Save to DB
        store.candidatesDb.push(...results);

        const currentSortedAndRanked = computeRanks(store.candidatesDb);
        return res.json({
          candidates: currentSortedAndRanked,
          jobDescription: store.activeJobDescription,
        });
      } catch (err: any) {
        console.error("General screening error:", err);
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // 3. Clear all screens
  app.post("/api/candidates/clear", (req, res) => {
    const email = getAuthenticatedUser(req);
    if (!email) {
      return res.status(401).json({ error: "Authentication required to reset pipeline." });
    }
    const store = getUserStore(email);
    store.candidatesDb = [];
    store.activeJobDescription = { text: "", title: "" };
    res.json({ success: true, message: "Pipeline cleared successfully." });
  });

  // 4. Delete single candidate
  app.delete("/api/candidates/:id", (req, res) => {
    const email = getAuthenticatedUser(req);
    if (!email) {
      return res.status(401).json({ error: "Authentication required to delete candidates." });
    }
    const store = getUserStore(email);
    const { id } = req.params;
    store.candidatesDb = store.candidatesDb.filter((c) => c.id !== id);
    res.json({ success: true, candidates: computeRanks(store.candidatesDb) });
  });

  // Development VS Production Routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});
