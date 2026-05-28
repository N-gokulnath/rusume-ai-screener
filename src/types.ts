export interface ExperienceRelevance {
  score: number;
  summary: string;
}

export interface EducationAlignment {
  status: "aligned" | "partially" | "not_aligned" | string;
  summary: string;
}

export interface ScreenedCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  fileName: string;
  matchScore: number;
  rank?: number;
  matchingSkills: string[];
  missingSkills: string[];
  experienceRelevance: ExperienceRelevance;
  educationAlignment: EducationAlignment;
  keyStrengths: string[];
  overallSummary: string;
  parsedText?: string;
  error?: string;
}

export interface JobDescriptionData {
  text: string;
  title?: string;
}

export interface ScreeningResult {
  candidates: ScreenedCandidate[];
  jobDescription: JobDescriptionData;
}
