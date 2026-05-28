# Resume Ranker (RankFlow) — AI-Powered Automated Talent Screening Engine

**Resume Ranker (RankFlow)** is a high-fidelity, full-stack resume screening and candidate ranking application. It is designed to optimize the initial HR recruitment pipeline by dynamically parsing, evaluating, and ranking applicant resumes against a target Job Description (JD).

Utilizing advanced natural language processing via the Google Gemini API and structured JSON schemas, RankFlow provides HR specialists with quantitative match scores, objective experience evaluations, and automated skill-gap analysis.

---

## 🚀 Key Features & Capabilities

### 1. Robust Resume & Document Parsing
* **Multi-Format Uploads**: Support for staging single or multiple candidate resumes concurrently.
* **Supported Formats**: `.pdf`, `.docx`, `.doc`, and `.txt` file parsing.
* **Dual-Pipeline Ingestion**: Uses Mammoth for Microsoft Word (`.docx`) file content extraction, and passes PDF binaries natively to Google's multimodal AI reader to ensure maximum parsing accuracy.

### 2. Job Description Management
* **Manual Inputs**: Recruiter-friendly rich title and criteria editor.
* **Preset Role Templates**: Direct loading of optimized templates for common roles (e.g. *Senior Full-Stack Developer*, *Technical Product Manager*, *Lead Data Scientist*).
* **JD Document Parsing**: Select or drag-and-drop a Job Description file to extract required criteria automatically.

### 3. Sincere AI Screening & Match Scoring
* Powered by the state-of-the-art `gemini-3.5-flash` model.
* Generates a calibrated overall **Match Score (0–100%)** based on four balanced comparison dimensions:
  1. **Skills Match**: Compares resume skills against the target tech stack/requirements.
  2. **Experience Relevance**: Evaluates seniority, former responsibilities, and industry context.
  3. **Education Alignment**: Classifies academic fit as `aligned`, `partially`, or `not_aligned` with objective rationales.
  4. **Standout Strengths**: Highlights the top 3 capabilities matching the position.
* **Skill-Gap Analysis**: Extracts exact matching skills and lists critical missing skills.

### 4. Recruiter Dashboard
* **Dynamic Candidate Ranking**: Automatic sorting from highest match score to lowest.
* **Live Search**: Client-side filtering by name, email, strengths, or matching skills.
* **Detail Panel**: Interactive tabs for exploring Screening Rationale, Skill Breakdown, Experience Score, and Raw Text Source.
* **Reset Pipeline**: Complete database purge to clear candidates and role criteria.
* **CSV Export**: Instantly downloads a complete HR ranking report with structured candidate fields.

---

## 🛠️ Technical Stack

* **Frontend**: React (v19) + Vite + Tailwind CSS + Lucide Icons + Motion (for beautiful layout animations and smooth UI transitions).
* **Backend**: Node.js + Express.
* **Database**: **Prisma ORM** with **SQLite** for zero-config local persistence (supports immediate switching to **PostgreSQL** or **MySQL** via environment variables).
* **AI Engine**: Google Gemini API via the official `@google/genai` client SDK.

---

## ⚙️ Configuration & Setup

### Prerequisites
Ensure you have **Node.js** (v18 or higher) installed on your system.

### 1. Install Dependencies
Clone the repository and run:
```bash
npm install
```

### 2. Configure Environment Variables
Create a file named `.env` in the root directory of the project and populate it with the following configuration:
```env
# GEMINI_API_KEY: Obtain from Google AI Studio (https://aistudio.google.com/)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# DATABASE_URL: Prisma database URL.
# SQLite database path (default zero-config local db):
DATABASE_URL="file:./dev.db"

# To use PostgreSQL or MySQL instead, simply update the provider in prisma/schema.prisma and set:
# DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
```

### 3. Run Database Migrations
Initialize the local SQLite database and generate the Prisma Client using:
```bash
npm run db:migrate
```
*This command creates your local `prisma/dev.db` database and builds TypeScript types for all models.*

### 4. Run the Application
Start the custom Express and Vite development server:
```bash
npm run dev
```
The application will be running locally at **`http://localhost:3000`**.

---

## 📖 Step-by-Step Usage Guide

### Step 1: Accessing the Dashboard
1. Open your browser and navigate to `http://localhost:3000`.
2. To test the dashboard quickly, log in using the preconfigured Sandbox Recruiter account:
   * **Email**: `demo@rankflow.ai`
   * **Password**: `demo123`
3. Alternatively, click **Sign Up** to create a completely isolated workspace.

### Step 2: Define Job Criteria
1. Click any of the **Load Standard Role Presets** pills to prefill typical criteria.
2. Edit the role title and modify the description requirements manually as needed.
3. *Optional*: Drag-and-drop or select a Job Description document (`.docx` / `.pdf` / `.txt`) to import guidelines directly.

### Step 3: Stage Resume Documents
1. Under **2. Candidate Resumes**, click the file uploader or drag-and-drop multiple candidate resumes (`.pdf` / `.doc` / `.docx` / `.txt`).
2. You will see a list of staged files. You can click the trash icon next to a file to unstage it.
3. *Optional*: Check the **Append to current session** box if you wish to add new candidates to your existing screening database instead of resetting the table.

### Step 4: Run Screening Pipeline
1. Click **Begin Resume Screening**. The dashboard will display a loader while sending documents to the Gemini analysis engine.
2. Once complete, the table will refresh, automatically ranking all candidates by match score.

### Step 5: Explore & Export
1. Click on any candidate row to open their detailed **Screening Profile** on the right side.
2. Toggle between **Screening Rationale**, **Skill-Gap Analysis**, **Experience Fit**, and **Source Resume**.
3. Use the search bar to query specific keywords or names.
4. Click **Export CSV** at the top right to download a comprehensive Excel-compatible report for the hiring team.
