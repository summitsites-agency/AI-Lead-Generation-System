# AI Lead Generator System (Summit Sites) — Full Build Spec + UI/UX + Implementation Plan --- # 0. OBJECTIVE Build a fully automated AI-powered lead generation system that: 1. Finds local businesses 2. Scrapes their websites 3. Analyzes website quality using AI 4. Scores leads based on conversion potential 5. Generates personalized outreach messages 6. Displays everything in a React SaaS-style dashboard 7. Stores leads in a database (SQLite / Supabase / Google Sheets optional) --- # 1. SYSTEM ARCHITECTURE ## 1.1 Full System Flow Frontend (React Dashboard) ↓ Backend API (Node.js / Express) ↓ Python Worker Service (Scraping + AI Processing) ↓ Free AI API (Groq / Gemini / OpenRouter) ↓ Database (SQLite MVP → upgrade optional) --- ## 1.2 Tech Stack ### Frontend - React (Vite) - TailwindCSS - Axios - React Query (optional) - Lucide Icons ### Backend - Node.js - Express.js - Prisma (optional) OR SQLite raw - Axios (calls Python service) ### Python Service - FastAPI OR Flask - Playwright (scraping) - BeautifulSoup (HTML parsing) - Requests - Async processing ### AI Providers (FREE ONLY) - Groq API - Google Gemini API (free tier) - OpenRouter (free models) - HuggingFace inference (optional) ### Database - SQLite (MVP) - Optional: Supabase / PostgreSQL --- # 2. CORE FEATURES --- ## 2.1 Lead Discovery Module ### Input - Industry (roofing, landscaping, dentists, etc.) - Location (e.g. Montreal) - Keywords (optional) ### Output
json
{
  "name": "",
  "website": "",
  "phone": "",
  "email": "",
  "address": "",
  "source": "google maps / directory"
}

## Data Sources

* Google Maps scraping (Playwright)
* Local directories
* YellowPages / Yelp-like listings
* Manual CSV import option

⸻

2.2 Website Scraper Module (Python)

Extract from each site:

* Title tag
* Meta description
* Full visible text
* Headings (H1–H3)
* CTA buttons
* Contact page presence
* Forms detection
* Load timing (basic performance check)
* Mobile friendliness heuristic

Example Structure

def scrape_website(url):
    html = requests.get(url, timeout=10).text
    soup = BeautifulSoup(html, "html.parser")
    return {
        "title": soup.title.text if soup.title else "",
        "text": soup.get_text(),
        "headings": [h.text for h in soup.find_all(["h1", "h2", "h3"])],
    }

⸻

2.3 AI Website Analysis Module

Prompt

You are a senior conversion rate optimization expert.
Analyze the website content and return JSON ONLY:
{
  "design_score": 1-10,
  "seo_score": 1-10,
  "conversion_score": 1-10,
  "issues": [],
  "opportunities": [],
  "summary": "",
  "lead_score": 0-100
}
Website Content:
{CONTENT}

Scoring Logic

* Missing CTA → +20 risk
* No contact info → +20 risk
* Weak SEO → +15 risk
* Poor mobile experience → +20 risk
* Outdated design → +25 risk

Normalize to:

* 0–40 = low priority
* 41–70 = medium
* 71–100 = high priority

⸻

2.4 Outreach Generator (AI)

Output Types:

* Cold email
* SMS version
* Follow-up message

Prompt

Write a short cold outreach message for a web design agency.
Requirements:
- 4–6 sentences max
- No hype language
- Must reference real issues found on the website
- Soft CTA only
Business Name:
{NAME}
Issues:
{ISSUES}

⸻

2.5 Lead Scoring Engine (Node.js)

function calculateLeadScore(aiOutput) {
  const score = aiOutput.lead_score;
  return {
    score,
    priority:
      score > 75 ? "HIGH" :
      score > 50 ? "MEDIUM" : "LOW"
  };
}

⸻

2.6 Dashboard Features (React)

* Lead table
* Lead detail drawer
* Analytics overview
* Scraper tool page
* Settings panel

⸻

3. FRONTEND DESIGN SYSTEM (FULL UI LAYER)

⸻

3.1 Design Philosophy

The UI must feel like a modern SaaS intelligence platform:

Inspired by:

* Linear (clean workflow systems)
* Stripe Dashboard (data clarity)
* Notion (minimal structure)

Focus:

* High-density data
* Fast scanning
* No clutter
* Professional SaaS feel

⸻

3.2 Color System

Base Theme (Dark SaaS)

* Background: #0B0F17
* Surface: #111827
* Borders: #1F2937
* Primary: #3B82F6
* Success: #10B981
* Warning: #F59E0B
* Danger: #EF4444
* Text Primary: #F9FAFB
* Text Secondary: #9CA3AF

⸻

3.3 Typography

* Font: Inter
* Headings: Semi-bold
* Body: Regular
* Numbers: Optional monospace emphasis

⸻

3.4 Layout System

Global Layout

* Left Sidebar (fixed, collapsible)
* Top Header (minimal)
* Main Content Area
* Right Slide-in Drawer (lead details)

⸻

3.5 Sidebar Navigation

* Dashboard
* Leads
* Scraper
* Campaigns
* Analytics
* Settings

Use simple line icons (Lucide preferred)

⸻

3.6 Dashboard Layout

KPI Cards (Top Row)

4 cards:

* Total Leads
* High Priority Leads
* Average Lead Score
* Estimated Conversions

Style:

* Rounded-xl
* Subtle border glow
* Large number + label

⸻

Lead Table (Core Component)

Columns:

* Business Name
* Industry tag (pill)
* Lead Score badge
* Website URL
* Status

Row interactions:

* Hover glow effect
* Click opens detail drawer

⸻

Lead Score Visualization

* 0–40 → red bar
* 41–70 → yellow bar
* 71–100 → green bar

Tooltip:
“Low mobile optimization, missing CTA, weak SEO”

⸻

3.7 Lead Detail Drawer

Section 1: Overview

* Business name
* Website link
* Score breakdown graph

Section 2: AI Insights

* Issues list
* Opportunities list

Section 3: Website Preview

* iframe preview (if possible)

Section 4: Outreach

Tabs:

* Email
* SMS
* Follow-up

Each with:

* Copy button
* Editable text field

⸻

3.8 Scraper Page UI

Inputs:

* Industry
* Location

Button:

* Start Scan

Live log output:

* Searching businesses…
* Found 42
* Scraping websites…
* 31 successful
* 11 failed

Progress bar required

⸻

3.9 UX Rules

* Smooth transitions (200–300ms)
* Skeleton loaders for leads
* Minimal animations only
* Fast response UI feel

⸻

3.10 Component Styling Rules

* Cards: rounded-xl
* Borders: subtle gray
* Buttons:
    * Primary: blue fill
    * Secondary: outline dark
* Inputs:
    * Dark filled background
    * Soft glow on focus

⸻

3.11 Data Density Rule

UI must:

* Maximize information per screen
* Avoid wasted whitespace
* Prioritize scanning efficiency
* Behave like an analytics terminal + SaaS hybrid

⸻

4. BACKEND API DESIGN

Routes

* GET /leads
* POST /leads/scrape
* POST /analyze
* POST /generate-outreach
* POST /save-lead

⸻

5. PYTHON SERVICE

Endpoints

POST /scrape

Input:

{ "url": "" }

POST /analyze

Returns AI structured analysis

POST /batch-scan

Processes multiple URLs concurrently

⸻

6. DATABASE SCHEMA

Leads Table

id INTEGER PRIMARY KEY
name TEXT
website TEXT
industry TEXT
score INTEGER
status TEXT
ai_summary TEXT
created_at TIMESTAMP

⸻

Outreach Table

id INTEGER PRIMARY KEY
lead_id INTEGER
message TEXT
type TEXT
sent BOOLEAN

⸻

7. AI PROVIDER CONFIG

System must support swapping providers:

AI_PROVIDER = "groq"
API_KEY = ""

Supported:

* Groq (recommended)
* Gemini (backup)
* OpenRouter (fallback)

⸻

8. WORKFLOW PIPELINE

1. User selects industry + location
2. System finds businesses
3. Python scrapes websites
4. AI analyzes content
5. Lead scoring applied
6. Outreach generated
7. Stored in DB
8. React dashboard displays everything

⸻

9. PERFORMANCE REQUIREMENTS

* 50–200 websites/day capability
* Parallel scraping (5–10 concurrent)
* Retry failed requests
* Cache results
* Avoid duplicate processing

⸻

10. ERROR HANDLING

* Timeout → retry once
* Invalid URL → skip
* AI failure → fallback scoring rules
* Missing fields → mark “unknown”

⸻

11. MVP BUILD ORDER

1. React dashboard scaffold
2. Node backend setup
3. Python scraper service
4. Single website pipeline
5. AI integration
6. Scoring engine
7. Outreach generator
8. Database integration
9. Batch processing

⸻

12. OPTIONAL UPGRADES

* Chrome extension scraper
* Auto email sending (Gmail API)
* CRM pipeline (Kanban view)
* Auto follow-up sequences
* Competitor comparison engine
* Multi-agent AI pipeline

⸻

13. FINAL OUTPUT GOAL

System must allow:

* Enter industry + location
* Generate full lead list
* Scrape + analyze websites
* Rank opportunities automatically
* Generate outreach messages
* Display everything in a SaaS dashboard

⸻

14. END RESULT UX (WHAT IT SHOULD FEEL LIKE)

A user should experience:

* Instant lead generation (under 2–3 minutes)
* Clean ranked list of opportunities
* Clear “why this lead matters”
* One-click copy outreach messages
* No technical friction

The system should feel like:

“AI-powered sales intelligence dashboard for web agencies”

---