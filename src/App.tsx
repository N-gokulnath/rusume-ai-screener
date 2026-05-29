import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  Search,
  Sparkles,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Download,
  User,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Info,
  TrendingUp,
  X,
  ChevronRight,
  AlertCircle,
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScreenedCandidate, JobDescriptionData } from "./types";
import { JD_TEMPLATES, JDTemplate } from "./templates";

export default function App() {
  // State
  const [candidates, setCandidates] = useState<ScreenedCandidate[]>([]);
  const [activeJD, setActiveJD] = useState<JobDescriptionData>({ text: "", title: "" });
  const [loading, setLoading] = useState<boolean>(false);
  const [initLoading, setInitLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("rankflow_token"));
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Inputs
  const [jdText, setJdText] = useState<string>("");
  const [jdTitle, setJdTitle] = useState<string>("");
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [appendMode, setAppendMode] = useState<boolean>(false);
  
  // Filtering & Sorting
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"score" | "name" | "rank">("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [scoreFilter, setScoreFilter] = useState<number>(0);
  
  // Detail Panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"analysis" | "skills" | "experience" | "source">("analysis");
  
  // Success / Error status messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Drag and Drop State
  const [isJdDragging, setIsJdDragging] = useState<boolean>(false);
  const [isResumeDragging, setIsResumeDragging] = useState<boolean>(false);

  // File Inputs references
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdFileInputRef = useRef<HTMLInputElement>(null);

  // Helper authFetch to simplify operations and auto logout on expiration/unauthorized
  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const activeToken = token || localStorage.getItem("rankflow_token");
    const headers = {
      ...(options.headers || {}),
      ...(activeToken ? { "Authorization": `Bearer ${activeToken}` } : {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setIsAuthenticated(false);
      setToken(null);
      localStorage.removeItem("rankflow_token");
      setCurrentUser(null);
    }
    return res;
  };

  // Auth initialization
  useEffect(() => {
    const initializeAuth = async () => {
      const activeToken = localStorage.getItem("rankflow_token");
      if (activeToken) {
        try {
          const res = await fetch("/api/auth/me", {
            headers: {
              "Authorization": `Bearer ${activeToken}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setCurrentUser(data.user);
            setIsAuthenticated(true);
            setToken(activeToken);
            await fetchCandidates(activeToken);
            return;
          } else {
            localStorage.removeItem("rankflow_token");
          }
        } catch (e) {
          console.error("Auth verification failed", e);
        }
      }
      setInitLoading(false);
    };

    initializeAuth();
  }, []);

  const fetchCandidates = async (explicitToken?: string) => {
    try {
      setInitLoading(true);
      const activeToken = explicitToken || token || localStorage.getItem("rankflow_token");
      if (!activeToken) {
        setInitLoading(false);
        return;
      }
      const res = await fetch("/api/candidates", {
        headers: {
          "Authorization": `Bearer ${activeToken}`
        }
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        setToken(null);
        localStorage.removeItem("rankflow_token");
        setCurrentUser(null);
        return;
      }
      if (!res.ok) {
        throw new Error("Could not retrieve screening status from servers.");
      }
      const data = await res.json();
      setCandidates(data.candidates || []);
      setActiveJD(data.jobDescription || { text: "", title: "" });
      
      // Auto-prefill editor if there is already a JD loaded
      if (data.jobDescription && data.jobDescription.text) {
        setJdText(data.jobDescription.text);
        setJdTitle(data.jobDescription.title || "");
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setInitLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Please fill out all credential fields.");
      setAuthLoading(false);
      return;
    }
    
    try {
      const endpoint = authTab === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload = {
        email: authEmail.trim(),
        password: authPassword.trim(),
        ...(authTab === "signup" ? { name: authName.trim() } : {})
      };
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }
      
      localStorage.setItem("rankflow_token", data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setSuccessMessage(authTab === "login" ? "Welcome back! Logged in successfully." : "Account created successfully! Welcome to RankFlow.");
      
      // Clear forms
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchCandidates(data.token);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("rankflow_token");
    setToken(null);
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCandidates([]);
    setActiveJD({ text: "", title: "" });
    setJdText("");
    setJdTitle("");
    setSuccessMessage("Logged out successfully.");
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Select pre-built templates
  const handleSelectTemplate = (tpl: JDTemplate) => {
    setJdText(tpl.text);
    setJdTitle(tpl.title);
    setSuccessMessage(`Loaded template for "${tpl.title}"`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Handle Drag & Drop
  const handleJdDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsJdDragging(true);
  };

  const handleJdDragLeave = () => {
    setIsJdDragging(false);
  };

  const handleJdDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsJdDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setJdFile(file);
      setJdTitle(file.name);
    }
  };

  const handleResumeDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsResumeDragging(true);
  };

  const handleResumeDragLeave = () => {
    setIsResumeDragging(false);
  };

  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsResumeDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setResumeFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveResume = (index: number) => {
    setResumeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearSelection = () => {
    setResumeFiles([]);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  };

  // Submit screening analyze pipeline
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate
    if (!jdText.trim() && !jdFile) {
      setErrorMessage("Please type a Job Description or upload a JD document first.");
      return;
    }

    if (resumeFiles.length === 0 && !appendMode) {
      // If we are just updating JD text without any files
      if (candidates.length > 0) {
        // Offer choice or proceed to screen existing?
        // Let's allow updating JD alone, but warn user
      } else {
        setErrorMessage("Please select at least one candidate resume file to evaluate.");
        return;
      }
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("jobDescriptionText", jdText);
      formData.append("jobDescriptionTitle", jdTitle);
      formData.append("append", appendMode.toString());

      if (jdFile) {
        formData.append("jobDescriptionFile", jdFile);
      }

      resumeFiles.forEach((file) => {
        formData.append("resumes", file);
      });

      const response = await authFetch("/api/screen", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Screening failed. Please verify API configurations.");
      }

      const data = await response.json();
      setCandidates(data.candidates || []);
      setActiveJD(data.jobDescription || { text: "", title: "" });
      
      setSuccessMessage(`Successfully processed ${resumeFiles.length} resumes! Automatically ranked candidates.`);
      setResumeFiles([]); // Reset file pile
      setJdFile(null); // Reset JD file

      // Prefill selected candidate with top rank
      if (data.candidates && data.candidates.length > 0) {
        setSelectedId(data.candidates[0].id);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during processing.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete candidate from screen
  const handleDeleteCandidate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await authFetch(`/api/candidates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        if (selectedId === id) {
          setSelectedId(data.candidates && data.candidates.length > 0 ? data.candidates[0].id : null);
        }
      }
    } catch (err: any) {
      setErrorMessage("Could not delete candidate: " + err.message);
    }
  };

  // Clear entire database pipeline completely
  const handleClearPipeline = async () => {
    if (!window.confirm("Are you sure you want to clear the current job description and all uploaded resumes? This is irreversible.")) {
      return;
    }
    try {
      const res = await authFetch("/api/candidates/clear", {
        method: "POST",
      });
      if (res.ok) {
        setCandidates([]);
        setActiveJD({ text: "", title: "" });
        setJdText("");
        setJdTitle("");
        setJdFile(null);
        setSelectedId(null);
        setSuccessMessage("Pipeline reset completed.");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage("Could not reset pipeline: " + err.message);
    }
  };

  // Export dynamically to CSV file
  const exportToCSV = () => {
    if (candidates.length === 0) return;
    const headers = [
      "Rank",
      "Candidate Name",
      "Match Score (%)",
      "Email Address",
      "Phone Number",
      "Resume Filename",
      "Standout Strengths",
      "Matching Skills",
      "Missing Skills",
      "Experience Summary",
      "Academic Qualifications",
      "Screening Rationale"
    ];

    const rows = candidates.map((c, index) => [
      c.rank || index + 1,
      c.name,
      c.matchScore,
      c.email || "N/A",
      c.phone || "N/A",
      c.fileName,
      c.keyStrengths.join("; "),
      c.matchingSkills.join("; "),
      c.missingSkills.join("; "),
      c.experienceRelevance?.summary || "N/A",
      c.educationAlignment?.summary || "N/A",
      c.overallSummary.replace(/"/g, '""')
    ]);

    const csvContent = [
      headers,
      ...rows
    ].map(e => e.map(val => `"${val}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Resume_Screening_Rankings_${activeJD.title ? activeJD.title.replace(/\s+/g, "_") : "Report"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle Sorting column
  const toggleSort = (field: "score" | "name" | "rank") => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  };

  // Candidates filtering based on Search Terms
  const filteredCandidates = candidates.filter((c) => {
    const textStr = `${c.name} ${c.email} ${c.matchingSkills.join(" ")} ${c.fileName} ${c.overallSummary}`.toLowerCase();
    const matchesSearch = textStr.includes(searchTerm.toLowerCase());
    const matchesScore = c.matchScore >= scoreFilter;
    return matchesSearch && matchesScore;
  });

  // Sort candidates list
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    let multiplier = sortOrder === "asc" ? 1 : -1;
    if (sortBy === "score") {
      return (a.matchScore - b.matchScore) * multiplier;
    } else if (sortBy === "name") {
      return a.name.localeCompare(b.name) * multiplier;
    } else if (sortBy === "rank") {
      const aRank = a.rank || 999;
      const bRank = b.rank || 999;
      return (aRank - bRank) * multiplier;
    }
    return 0;
  });

  const selectedCandidate = candidates.find(c => c.id === selectedId) || null;

  // Compute key stats metrics
  const totalScreened = candidates.length;
  const highFitCount = candidates.filter(c => c.matchScore >= 80).length;
  const averageScore = totalScreened > 0 ? Math.round(candidates.reduce((sum, c) => sum + c.matchScore, 0) / totalScreened) : 0;
  const topCandidate = candidates.length > 0 ? [...candidates].sort((a,b) => b.matchScore - a.matchScore)[0] : null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#212529] antialiased flex flex-col" id="main_applet_container">
      
      {/* Banner Notification Headers */}
      {errorMessage && (
        <div className="bg-red-55 px-5 py-3 border-b border-red-100 flex items-center justify-between sticky top-0 z-50 text-xs shadow-sm bg-red-50 text-red-850" id="global_error_banner">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span><strong>Screening Error:</strong> {errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="hover:bg-red-100 p-1 rounded-full transition-colors">
            <X className="w-3.5 h-3.5 text-red-800" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 text-emerald-900 px-5 py-3 border-b border-emerald-100 flex items-center justify-between sticky top-0 z-50 text-xs shadow-sm" id="global_success_banner">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="hover:bg-emerald-100 p-1 rounded-full transition-colors">
            <X className="w-3.5 h-3.5 text-emerald-800" />
          </button>
        </div>
      )}

      {/* Clean Minimalism Navbar */}
      <nav className="h-16 border-b border-[#E9ECEF] bg-white flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-40" id="app_main_header">
        <div className="flex items-center gap-3">
          <img src="/assets/favicon_logo.png" alt="RankFlow Logo" className="w-8 h-8 object-contain rounded-md" />
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-widest text-[#1E3A8A] uppercase">RankFlow</span>
            <span className="text-[9px] text-slate-400 font-medium font-mono leading-none tracking-tight">AI SCREENING ENGINE</span>
          </div>
          {isAuthenticated && activeJD.title && (
            <span className="text-xs text-slate-400 border-l border-slate-200 pl-3 font-mono hidden md:inline truncate max-w-xs" title={activeJD.title}>
              Active Profile: {activeJD.title}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-2 border-r border-[#E9ECEF] pr-3 hidden sm:flex">
              <div className="w-7 h-7 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-blue-650" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold text-gray-800 leading-none">{currentUser.name}</span>
                <span className="text-[9px] text-gray-400 font-mono leading-none mt-0.5">{currentUser.email}</span>
              </div>
            </div>
          )}
          {isAuthenticated && candidates.length > 0 && (
            <>
              <button
                type="button"
                onClick={exportToCSV}
                className="px-4 py-2 text-xs font-semibold border border-[#E9ECEF] rounded-md bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                id="header_excel_export_btn"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleClearPipeline}
                className="px-4 py-2 text-xs font-semibold border border-red-100 rounded-md bg-red-50 hover:bg-red-100 text-red-650 transition-colors cursor-pointer"
                id="header_clear_pipeline_btn"
              >
                Reset
              </button>
            </>
          )}
          {isAuthenticated && (
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-semibold border border-[#E9ECEF] rounded-md bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              id="header_logout_btn"
            >
              Log Out
            </button>
          )}
        </div>
      </nav>

      {/* Main Work Area */}
      <main className={`max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col ${!isAuthenticated || initLoading ? "justify-center items-center" : ""}`} id="main_layout_body">
        {initLoading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-[#E9ECEF] shadow-3xs w-full max-w-md" id="app_initial_loader">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600"></span>
            </div>
            <p className="text-gray-500 text-xs mt-4 font-semibold font-mono animate-pulse uppercase tracking-wider">Verifying Session credentials...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="w-full max-w-md bg-white border border-[#E9ECEF] rounded-2xl shadow-3xs overflow-hidden p-8 flex flex-col gap-6" id="auth_form_card">
            <div className="text-center">
              <img src="/assets/favicon_logo.png" alt="RankFlow Logo" className="w-12 h-12 object-contain rounded-xl mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-900 font-sans tracking-tight">
                {authTab === "login" ? "Welcome back" : "Create developer profile"}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {authTab === "login" ? "Access your isolated resume screening pipeline." : "Initialize isolated workspace to resume screening."}
              </p>
            </div>

            {/* Toggle Tab buttons */}
            <div className="flex border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-center" id="auth_tabs">
              <button
                type="button"
                onClick={() => { setAuthTab("login"); setAuthError(null); }}
                className={`flex-1 pb-3 cursor-pointer transition-colors border-b-2 font-semibold ${
                  authTab === "login"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab("signup"); setAuthError(null); }}
                className={`flex-1 pb-3 cursor-pointer transition-colors border-b-2 font-semibold ${
                  authTab === "signup"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-xs flex items-start gap-2" id="auth_errors_banner">
                <AlertCircle className="w-4 h-4 text-red-650 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
              {authTab === "signup" && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 bg-white outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="recruiter@company.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 bg-white outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 bg-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2.5 text-xs font-bold uppercase tracking-wider transition-all shadow-3xs hover:shadow-2xs disabled:opacity-50 cursor-pointer flex justify-center items-center gap-1.5"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin"></div>
                ) : authTab === "login" ? (
                  "Access Dashboard"
                ) : (
                  "Register Workspace"
                )}
              </button>
            </form>

            {/* Sandbox Demo Credentials message box */}
            <div className="bg-[#F8F9FA]/65 border border-gray-200/50 rounded-lg p-3.5 text-[11px] text-gray-500 self-stretch" id="preset_creds_info">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-700">Quick Sandbox Demo Access:</p>
                  <p className="mt-0.5 leading-relaxed text-gray-500">
                    Log in directly using preconfigured demo recruiter account:
                  </p>
                  <code className="block bg-white border border-gray-205 border-gray-200 rounded px-1.5 py-1 mt-1 font-mono text-[10px] text-blue-700">
                    Email: demo@rankflow.ai<br />
                    Password: demo123
                  </code>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full" id="content_grid">
            
            {/* LEFT INPUT COLUMN (4 columns index on lg) */}
            <div className="lg:col-span-4 flex flex-col gap-6" id="setup_input_column">
              
              {/* Form card holding JD + Resume files */}
              <div className="bg-white border border-[#E9ECEF] rounded-xl p-6 flex flex-col gap-5" id="form_criteria_panel">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">1. Role & Requirements</h2>
                    <p className="text-[11px] text-gray-400">Define criteria & stage resume documents</p>
                  </div>
                  <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                </div>

                <form onSubmit={handleAnalyze} className="flex flex-col gap-5">
                  {/* Job Description block */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Job Description</label>

                    {/* Pre-fill quick templates */}
                    <div className="mb-3">
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-tight mb-1.5">Load Standard Role Preset:</p>
                      <div className="flex flex-wrap gap-1" id="templates_pill_box">
                        {JD_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.title}
                            type="button"
                            onClick={() => handleSelectTemplate(tpl)}
                            className="px-2.5 py-1 border border-gray-200 rounded text-[10px] bg-white text-gray-650 hover:bg-gray-50 focus:outline-none transition-colors cursor-pointer font-medium"
                          >
                            {tpl.title.split(" (")[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Role / Job Title (e.g. Senior Frontend Engineer)"
                        value={jdTitle}
                        onChange={(e) => setJdTitle(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-semibold"
                      />
                      
                      <textarea
                        rows={7}
                        placeholder="Paste requirements, tech stack details, alignment guidelines, or minimum requirements for automated match ranking..."
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-mono text-gray-700 bg-gray-50/50 resize-y leading-relaxed"
                      />
                    </div>

                    {/* File Drop for JD optional */}
                    <div
                      onDragOver={handleJdDragOver}
                      onDragLeave={handleJdDragLeave}
                      onDrop={handleJdDrop}
                      onClick={() => jdFileInputRef.current?.click()}
                      className={`mt-2.5 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all flex items-center justify-center gap-2 ${
                        isJdDragging ? "border-blue-500 bg-blue-50/50" : "border-gray-250 border-gray-200 hover:border-blue-400 hover:bg-gray-50/50"
                      }`}
                    >
                      <input
                        type="file"
                        ref={jdFileInputRef}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setJdFile(file);
                            setJdTitle(file.name);
                          }
                        }}
                        className="hidden"
                        accept=".txt,.docx,.pdf"
                      />
                      <FolderOpen className="w-4 h-4 text-gray-405 text-gray-450" />
                      <div className="text-left">
                        <p className="text-[10px] font-bold text-gray-700">
                          {jdFile ? `Files loaded: ${jdFile.name}` : "Or select JD Document file"}
                        </p>
                        <p className="text-[9px] text-gray-400">PDF, DOCX, TXT</p>
                      </div>
                      {jdFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJdFile(null);
                          }}
                          className="ml-auto text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resume Upload Area */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Resume Upload</label>

                    <div
                      onDragOver={handleResumeDragOver}
                      onDragLeave={handleResumeDragLeave}
                      onDrop={handleResumeDrop}
                      onClick={() => resumeInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center gap-2 transition-all h-36 ${
                        isResumeDragging
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                      }`}
                      id="resume_drag_drop_zone"
                    >
                      <input
                        type="file"
                        ref={resumeInputRef}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setResumeFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                          }
                        }}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt"
                        multiple
                      />
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                      <span className="text-xs font-semibold text-gray-600">Drop resumes here or browse</span>
                      <span className="text-[10px] text-gray-400">PDF, DOCX, TXT supported</span>
                    </div>

                    {/* Staged files count and preview list */}
                    {resumeFiles.length > 0 && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200" id="staged_resumes_list">
                        <div className="flex items-center justify-between mb-2 px-1 border-b border-gray-200 pb-1.5">
                          <span className="text-[10px] font-bold text-gray-650 uppercase tracking-widest">Staged Resumes ({resumeFiles.length})</span>
                          <button
                            type="button"
                            onClick={clearSelection}
                            className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
                          >
                            Remove All
                          </button>
                        </div>
                        <ul className="text-2xs text-gray-600 space-y-1 max-h-36 overflow-y-auto font-mono">
                          {resumeFiles.map((file, idx) => (
                            <li key={`${file.name}-${idx}`} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-gray-200/80">
                              <span className="truncate max-w-[85%] font-medium text-gray-700">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveResume(idx)}
                                className="text-gray-400 hover:text-red-500 focus:outline-none transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Mode Settings */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Screening Settings</span>
                    
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={appendMode}
                        onChange={(e) => setAppendMode(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <p className="text-[11px] font-bold text-gray-800">Append Resumes to Pipeline</p>
                        <p className="text-[9px] text-gray-400">Keep already parsed reports and insert new candidates alongside.</p>
                      </div>
                    </label>
                  </div>

                  {/* Actions Submit */}
                  <button
                    type="submit"
                    disabled={submitting || (!jdText.trim() && !jdFile)}
                    className={`w-full py-3 rounded-lg text-xs font-semibold uppercase tracking-wider text-white transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      submitting || (!jdText.trim() && !jdFile)
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-sm hover:shadow"
                    }`}
                    id="submit_screen_action_btn"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                        <span>SCREENING APPLICANTS...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                        <span>RUN SCREENING PIPELINE</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Active JD Summary Box */}
              {activeJD.text && (
                <div className="bg-white border border-[#E9ECEF] rounded-xl p-5" id="active_jd_overview">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-450 text-gray-400 block mb-2">Active Screening Job Profile</span>
                  <p className="text-sm font-bold text-gray-900 truncate mb-2">{activeJD.title || "Target Guidelines Profile"}</p>
                  
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 max-h-36 overflow-y-auto">
                    <p className="text-[11px] font-mono text-gray-600 whitespace-pre-wrap leading-relaxed select-all">
                      {activeJD.text}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT DASHBOARD CONTENT ROW (8 columns index on lg) */}
            <div className="lg:col-span-8 flex flex-col gap-6" id="dashboard_view_column">
              
              {/* Analytics Summary Stats widget */}
              {candidates.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="stats_overview_cards">
                  <div className="bg-white border border-[#E9ECEF] rounded-xl p-4 shadow-3xs">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Screened Candidates</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-gray-900">{totalScreened}</span>
                      <span className="text-[10px] text-gray-400 font-mono">total</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E9ECEF] rounded-xl p-4 shadow-3xs">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Strong Fits (≥80%)</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-emerald-700">{highFitCount}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        ({totalScreened > 0 ? Math.round((highFitCount / totalScreened) * 100) : 0}%)
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E9ECEF] rounded-xl p-4 shadow-3xs">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Average Fit Score</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-blue-700">{averageScore}%</span>
                      <span className="text-[10px] text-gray-400 font-mono">avg</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E9ECEF] rounded-xl p-4 shadow-3xs">
                    <p className="text-[10px] font-bold text-gray-450 text-gray-400 uppercase tracking-wider">Top Match Pick</p>
                    <div className="mt-1 truncate">
                      <p className="text-xs font-bold text-blue-800 truncate">{topCandidate ? topCandidate.name : "N/A"}</p>
                      <p className="text-[9px] text-gray-400 font-mono leading-none mt-0.5">{topCandidate ? `Score: ${topCandidate.matchScore}%` : ""}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Candidates rankings list + detailed panel split */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5" id="assessment_pipeline_body">
                
                {/* Candidates List Panel (7 columns of 12) */}
                <div className={`col-span-12 ${selectedId ? "md:col-span-6" : "md:col-span-12"} bg-white border border-[#E9ECEF] rounded-xl overflow-hidden flex flex-col`}>
                  
                  {/* Table/List Header filter actions */}
                  <div className="bg-[#F8F9FA]/50 border-b border-[#E9ECEF] p-4">
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search candidates, skills, files..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-1.5 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 font-mono outline-none bg-white placeholder:text-gray-450"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fit Threshold &ge;</span>
                        <select
                          value={scoreFilter}
                          onChange={(e) => setScoreFilter(Number(e.target.value))}
                          className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="0">All Matches</option>
                          <option value="50">50% +</option>
                          <option value="70">70% +</option>
                          <option value="80">80% +</option>
                          <option value="90">90% +</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Main Candidate Table */}
                  <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[580px]">
                    {candidates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-16 text-center text-gray-400" id="empty_state">
                        <FileText className="w-12 h-12 stroke-[1] text-gray-300 mb-3" />
                        <h3 className="text-sm font-semibold text-gray-700">No Screened Candidates</h3>
                        <p className="text-[11px] max-w-sm mt-1 px-4 leading-relaxed text-gray-400">
                          Initialize screening by pasting a Job Description, staging resume documents on the left setup panel, and running the ranking parser.
                        </p>
                      </div>
                    ) : sortedCandidates.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs font-medium">
                        No candidates match the selected filters.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse" id="candidates_results_table">
                        <thead>
                          <tr className="bg-[#F8F9FA]/50 border-b border-[#E9ECEF] text-gray-400 text-[10px] font-bold uppercase select-none">
                            <th className="py-3 px-4 text-center w-14 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort("rank")}>
                              <div className="inline-flex items-center gap-1">
                                <span>Rank</span>
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </th>
                            <th className="py-3 px-4 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort("name")}>
                              <div className="inline-flex items-center gap-1">
                                <span>Candidate</span>
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:bg-gray-100 w-24" onClick={() => toggleSort("score")}>
                              <div className="inline-flex items-center gap-1">
                                <span>Score</span>
                                <ArrowUpDown className="w-3 h-3" />
                              </div>
                            </th>
                            <th className="py-3 px-4 text-right w-14">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                          {sortedCandidates.map((cand, idx) => {
                            const isSelected = cand.id === selectedId;
                            const isHighFit = cand.matchScore >= 80;
                            const isLowFit = cand.matchScore < 50;

                            return (
                              <tr
                                key={cand.id}
                                onClick={() => setSelectedId(cand.id)}
                                className={`group cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-blue-50/30 hover:bg-blue-50/55"
                                    : "hover:bg-blue-50/20"
                                }`}
                              >
                                {/* Rank */}
                                <td className="py-4 px-4 text-center font-mono text-gray-455 text-gray-400">
                                  {String(cand.rank || idx + 1).padStart(2, "0")}
                                </td>

                                {/* Name & Filename */}
                                <td className="py-4 px-4 max-w-0">
                                  <div className="truncate font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                                    {cand.name}
                                  </div>
                                  <div className="truncate text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                                    <FileText className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span>{cand.fileName}</span>
                                  </div>
                                </td>

                                {/* Match Score */}
                                <td className="py-4 px-4 text-center">
                                  {cand.error ? (
                                    <span className="text-[10px] font-bold text-red-600" title={cand.error}>Error</span>
                                  ) : (
                                    <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full ${
                                      isHighFit
                                        ? "bg-green-105 bg-green-100 text-green-700"
                                        : isLowFit
                                          ? "bg-gray-100 text-gray-600"
                                          : "bg-amber-100 text-amber-700"
                                    }`}>
                                      {cand.matchScore}% Match
                                    </span>
                                  )}
                                </td>

                                {/* Trash bin */}
                                <td className="py-4 px-4 text-right">
                                  <button
                                    onClick={(e) => handleDeleteCandidate(cand.id, e)}
                                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 inline-block focus:outline-none cursor-pointer"
                                    title="Delete candidate report"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Candidate Detailed Match Panel (5/12 columns) */}
                <AnimatePresence>
                  {selectedCandidate && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.15 }}
                      className="col-span-12 md:col-span-6 bg-white border border-[#E9ECEF] rounded-xl flex flex-col overflow-hidden shadow-sm"
                    >
                      {/* Header block with Name and Score Badge */}
                      <div className="bg-[#111827] text-white p-6 relative" id="detail_header">
                        <button
                          onClick={() => setSelectedId(null)}
                          className="absolute right-4 top-4 hover:bg-white/10 p-1.5 rounded-full transition-colors text-white/70 hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center font-mono text-center outline-dashed outline-1 outline-offset-2 ${
                            selectedCandidate.matchScore >= 80 ? "bg-emerald-600 outline-emerald-400" : selectedCandidate.matchScore >= 50 ? "bg-amber-500 outline-amber-300" : "bg-red-600 outline-red-400"
                          }`}>
                            <span className="text-[10px] font-bold tracking-widest text-white/80 leading-none">FIT</span>
                            <span className="text-lg font-bold leading-none mt-1">{selectedCandidate.matchScore}%</span>
                          </div>

                          <div className="max-w-[70%]">
                            <h3 className="font-bold text-base leading-tight truncate">{selectedCandidate.name}</h3>
                            <span className="text-[10px] text-white/50 bg-white/10 px-2.5 py-1 rounded inline-block mt-1 font-mono tracking-wider font-semibold">
                              RANK {String(selectedCandidate.rank || 1).padStart(2, "0")}
                            </span>
                          </div>
                        </div>

                        {/* Contact details list */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-[11px] text-white/75 border-t border-white/10 pt-3.5 font-mono">
                          {selectedCandidate.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-blue-400" />
                              <a href={`mailto:${selectedCandidate.email}`} className="hover:underline">{selectedCandidate.email}</a>
                            </span>
                          )}
                          {selectedCandidate.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{selectedCandidate.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tab buttons to switch details */}
                      <div className="flex border-b border-[#E9ECEF] bg-gray-50/50 text-gray-500 text-[10px] uppercase font-bold tracking-wider font-mono">
                        <button
                          onClick={() => setDetailTab("analysis")}
                          className={`flex-1 py-3 text-center transition-colors border-b-2 font-bold cursor-pointer ${
                            detailTab === "analysis"
                              ? "bg-white text-blue-600 border-blue-600"
                              : "hover:bg-gray-100 hover:text-gray-805 border-transparent text-gray-400"
                          }`}
                        >
                          Insight Overview
                        </button>
                        <button
                          onClick={() => setDetailTab("skills")}
                          className={`flex-1 py-3 text-center transition-colors border-b-2 font-bold cursor-pointer ${
                            detailTab === "skills"
                              ? "bg-white text-blue-600 border-blue-600"
                              : "hover:bg-gray-100 hover:text-gray-805 border-transparent text-gray-400"
                          }`}
                        >
                          Skills Match
                        </button>
                        <button
                          onClick={() => setDetailTab("experience")}
                          className={`flex-1 py-3 text-center transition-colors border-b-2 font-bold cursor-pointer ${
                            detailTab === "experience"
                              ? "bg-white text-blue-600 border-blue-600"
                              : "hover:bg-gray-100 hover:text-gray-805 border-transparent text-gray-400"
                          }`}
                        >
                          Experience / Edu
                        </button>
                        <button
                          onClick={() => setDetailTab("source")}
                          className={`flex-1 py-3 text-center transition-colors border-b-2 font-bold cursor-pointer ${
                            detailTab === "source"
                              ? "bg-white text-blue-600 border-blue-600"
                              : "hover:bg-gray-100 hover:text-gray-805 border-transparent text-gray-400"
                          }`}
                        >
                          Resume Text
                        </button>
                      </div>

                      {/* Tab Body contents */}
                      <div className="p-5 flex-1 overflow-y-auto max-h-[420px]" id="detail_tab_body">
                        
                        {/* 1. ANALYSIS INTERFACE */}
                        {detailTab === "analysis" && (
                          <div className="flex flex-col gap-5">
                            <div>
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-mono">Overview Summary</h4>
                              <p className="text-xs text-gray-700 leading-relaxed bg-blue-50/10 border border-blue-100/30 rounded-lg p-4 font-semibold">
                                {selectedCandidate.overallSummary || "No screening description generated."}
                              </p>
                            </div>

                            {/* Standout achievements highlights */}
                            {selectedCandidate.keyStrengths && selectedCandidate.keyStrengths.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1 font-mono">
                                  <span>Top Highlights & Strengths</span>
                                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                                </h4>
                                <ul className="space-y-2">
                                  {selectedCandidate.keyStrengths.map((str, i) => (
                                    <li key={i} className="text-xs text-gray-700 bg-gray-55 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2 flex items-start gap-2.5">
                                      <span className="text-blue-600 font-extrabold mt-0.5 select-none">•</span>
                                      <span>{str}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Candidate Error report fallback */}
                            {selectedCandidate.error && (
                              <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-bold">Parsing Error Info:</p>
                                  <p className="mt-0.5">{selectedCandidate.error}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. SKILLS ENHANCED LIST */}
                        {detailTab === "skills" && (
                          <div className="flex flex-col gap-5">
                            {/* Matching skills block */}
                            <div>
                              <h4 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-mono">
                                <span className="bg-emerald-100 p-0.5 rounded-full"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></span>
                                <span>Matching Key Skills ({selectedCandidate.matchingSkills.length})</span>
                              </h4>
                              {selectedCandidate.matchingSkills.length === 0 ? (
                                <p className="text-[11px] text-gray-400 italic">No specific matching skills explicitly called out.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedCandidate.matchingSkills.map((sk) => (
                                    <span key={sk} className="text-xs bg-green-50 text-green-805 text-green-700 border border-green-100 px-2.5 py-1 rounded font-semibold font-sans">
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Missing skills gap analyzer */}
                            <div className="pt-3 border-t border-gray-100">
                              <h4 className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-mono">
                                <span className="bg-red-100 p-0.5 rounded-full"><XCircle className="w-3.5 h-3.5 text-red-600" /></span>
                                <span>Core Missing Skills ({selectedCandidate.missingSkills.length})</span>
                              </h4>
                              {selectedCandidate.missingSkills.length === 0 ? (
                                <p className="text-[11px] text-gray-400 italic">This candidate satisfies all identified skill requirements in the JD.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedCandidate.missingSkills.map((sk) => (
                                    <span key={sk} className="text-xs bg-red-50 text-red-800 border border-red-100 px-2.5 py-1 rounded font-semibold font-sans">
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 3. EXPERIENCE AND EDUCATION */}
                        {detailTab === "experience" && (
                          <div className="flex flex-col gap-4">
                            {/* Experience Card */}
                            <div className="bg-gray-50/50 border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-2.5">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                                  <span>Experience Relevance</span>
                                </h4>
                                <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-105 border-blue-100 font-bold px-2 py-0.5 rounded-md font-mono">
                                  {selectedCandidate.experienceRelevance?.score || 0}% Match
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed">
                                {selectedCandidate.experienceRelevance?.summary || "No career summary available."}
                              </p>
                            </div>

                            {/* Education Card */}
                            <div className="bg-gray-50/50 border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-2.5">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                  <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                                  <span>Education Alignment</span>
                                </h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  selectedCandidate.educationAlignment?.status === "aligned"
                                    ? "bg-emerald-55 bg-emerald-50 text-emerald-800 border border-emerald-250 border-emerald-200"
                                    : selectedCandidate.educationAlignment?.status === "partially"
                                      ? "bg-amber-50 text-amber-850 text-amber-800 border border-amber-200"
                                      : "bg-red-50 text-red-800 border border-red-200"
                                }`}>
                                  {selectedCandidate.educationAlignment?.status?.toUpperCase().replace("_", " ") || "UNKNOWN"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed">
                                {selectedCandidate.educationAlignment?.summary || "No academic records identified."}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 4. RAW EXTRACTED SOURCE */}
                        {detailTab === "source" && (
                          <div>
                            <div className="bg-[#111827] text-gray-300 font-mono text-[10px] p-4 rounded-lg overflow-x-auto max-h-[300px] whitespace-pre-wrap leading-relaxed select-text">
                              {selectedCandidate.parsedText || "No raw candidate data extracted."}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 text-center font-mono">
                              Extracted from uploaded archive file: <span className="font-semibold">{selectedCandidate.fileName}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
