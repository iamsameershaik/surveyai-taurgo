# SurveyAI

> **AI-powered property defect analysis for the PropTech industry**
> Built for the Taurgo × Cardiff University AI Hackathon — March 2026

© 2026 Sameer Shaik — non-commercial use only.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-surveyaixtaurgo.netlify.app-1A3A6B?style=for-the-badge)](https://surveyaixtaurgo.netlify.app)
[![Built With](https://img.shields.io/badge/Powered%20by-Claude%20Sonnet%204-C9943A?style=for-the-badge)](https://anthropic.com)
[![Stack](https://img.shields.io/badge/Stack-React%20%2B%20TypeScript%20%2B%20Netlify-1A2035?style=for-the-badge)](#tech-stack)

🎥 **2-Minute Product Demo:** [Watch the demo](./public/demo/demo-video.mp4)
---

## Problem Statement

Property managers and landlords across the UK manage portfolios with hundreds of individual assets. Identifying, classifying, and prioritising structural defects traditionally requires a qualified surveyor to attend each site — a process that is expensive, slow, and difficult to scale.

Meanwhile, photographic records of properties already exist in abundance. The gap is not data; it is analysis.

**SurveyAI closes that gap.** Upload photographs of any property space, and SurveyAI generates a structured, RICS-aligned survey report in seconds — complete with defect classification, severity scoring, indicative repair costs, and prioritised action recommendations. Across multiple properties, the Portfolio Comparison Dashboard surfaces the most urgent issues across the entire estate in a single view.

---

## Live Demo

**[surveyaixtaurgo.netlify.app](https://surveyaixtaurgo.netlify.app)**

No login required. Upload any property image (JPG, PNG, HEIC) to generate a report.

![Upload Screen](/screenshots/upload_screen.png)

---

## Features

### Core Analysis
- **AI Vision Analysis** — Claude claude-sonnet-4-20250514 analyses property images and returns structured JSON conforming to a RICS-aligned defect schema
- **Severity Classification** — Five-tier system: Monitor / Low / Medium / High / Critical, with a 0–100 numeric severity score
- **Defect Taxonomy** — 8 Tier-1 categories and 40+ Tier-2 subtypes with confidence scoring per defect
- **Defect Zone Overlay** — Bounding box annotations on the source image showing the precise location of identified defects
- **RICS-Standard Language** — Survey descriptions, urgency ratings, and recommendations written to professional survey conventions
- **Standards Citations** — Relevant RICS guidance notes, British Standards, and UK Building Regulations cited per report
![Defect Overlay](/screenshots/damage_overlay.png)

### Cost & Risk Intelligence
- **Indicative Repair Costs** — Low / mid / high estimates grounded in 2025 UK market rates (GBP)
- **Risk Matrix** — Likelihood × Impact scoring visualised as an interactive grid
- **Analysis Limitations** — Amber warning banner when image quality is insufficient for confident assessment
![Risk Scale](/screenshots/risk_scale.png)
![Generated Report](/screenshots/generated_report.png)

### Portfolio Tools
- **Portfolio Comparison Dashboard** — Severity timeline, defect frequency heatmap, and combined cost estimate across all analysed properties (activates at 2+ images)
- **Priority Action Summary** — Surfaces the single most urgent defect across the portfolio, ranked by severity first, then frequency and confidence
- **Report Q&A** — Ask natural language questions about any individual report; answered in context by Claude
![Portfolio Comparison](/screenshots/portfolio_comparison.png)

### Export & UX
- **PDF Export** — Full multi-page PDF report with cover page, per-property report pages, and portfolio summary page (jsPDF)
- **Copy to Clipboard** — Full plain-text report for pasting into existing property management systems
- **HEIC Support** — iOS HEIC images converted to JPEG automatically on upload
- **Session Caching** — Fingerprint-based caching ensures re-uploading the same image returns a consistent result within a session
- **Analysis Progress Modal** — Per-image stage tracking (preprocessing → classifying → generating → scoring)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │UploadSection│    │useImageAnalys│    │  ReportSection    │   │
│  │             │───▶│     is       │───▶│  ComparisonDash   │   │
│  │ File picker │    │ (React hook) │    │  ReportQA         │   │
│  │ HEIC→JPEG   │    │ imagesRef    │    │  DefectHighlight  │   │
│  │ Fingerprint │    │ Session cache│    │  Viewer           │   │
│  └─────────────┘    └──────┬───────┘    └───────────────────┘   │
│                            │                                    │
│                     fetch POST /analyse                         │
└────────────────────────────┼────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ Netlify Function │
                    │  analyse.js      │
                    │                  │
                    │ • API key guard  │
                    │ • 25s timeout    │
                    │ • JSON validate  │
                    │ • Auto-retry     │
                    └────────┬─────────┘
                             │
                    ┌────────▼────────┐
                    │  Anthropic API  │
                    │                 │
                    │ claude-sonnet-  │
                    │ 4-20250514      │
                    │ Vision + JSON   │
                    └─────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Serverless function proxy | API key never exposed to client; enables timeout control and validation layer |
| Sequential image processing | Eliminates React state race conditions that caused crashes with parallel `Promise.all` |
| `imagesRef` pattern | Avoids stale closure reads in async callbacks — critical for correct HEIC handling |
| HEIC conversion at upload | Single conversion upstream; both thumbnail and analysis pipeline consume the same JPEG data URL |
| Session fingerprint cache | `file.size + hash(first 8KB) + context` key prevents re-analysis variance without persisting data |
| JSON schema validation + retry | Malformed AI responses are caught server-side and retried once before surfacing an error |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18.3 + TypeScript 5.5 |
| Build tool | Vite 5.4 |
| Styling | Tailwind CSS 3.4 |
| Animation | Framer Motion 12 |
| Icons | Lucide React |
| PDF generation | jsPDF 4.2 |
| HEIC conversion | heic2any 0.0.4 |
| Deployment | Netlify (static + serverless functions) |
| AI model | Claude claude-sonnet-4-20250514 (Anthropic) |
| API integration | Anthropic Messages API v1 via Netlify function |

---

## Setup & Deployment

### Prerequisites

- Node.js 18+
- Netlify CLI (`npm install -g netlify-cli`)
- An Anthropic API key

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/iamsameershaik/surveyai-taurgo.git
cd surveyai/project

# 2. Install dependencies
npm install

# 3. Create a .env file
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# 4. Start the dev server (Netlify CLI required for functions)
netlify dev
```

The app will be available at `http://localhost:8888`. The Netlify CLI proxies function calls locally so the full analysis pipeline works without deployment.

### Production Deployment

```bash
# Build and deploy to Netlify
netlify deploy --prod --dir=dist
```

Or connect the repository to Netlify via the dashboard for automatic deployments on push.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key. Set in Netlify dashboard under Site Settings → Environment Variables. Never commit this to the repository. |

The key is accessed only within `netlify/functions/analyse.js` and `netlify/functions/qa.js` — it is never sent to or exposed in the browser.

---

## Project Structure

```
project/
├── netlify/
│   └── functions/
│       ├── analyse.js          # Main analysis handler + JSON validation
│       └── qa.js               # Report Q&A handler
├── src/
│   ├── components/
│   │   ├── AnalysisProgressModal.tsx
│   │   ├── ComparisonDashboard.tsx
│   │   ├── DefectHighlightViewer.tsx
│   │   ├── HeroSection.tsx
│   │   ├── ReportQA.tsx
│   │   ├── ReportSection.tsx
│   │   ├── SeverityGauge.tsx
│   │   └── UploadSection.tsx
│   ├── hooks/
│   │   ├── useComparison.ts    # Portfolio aggregation + priority ranking
│   │   └── useImageAnalysis.ts # Core analysis pipeline + caching
│   ├── utils/
│   │   └── generatePDF.ts      # Full jsPDF report generation
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── utils.ts                # Prompt builder, compression, API call
│   └── App.tsx
├── netlify.toml
└── package.json
```

---

## Evaluation Criteria Mapping

| Criterion | Weight | How SurveyAI addresses it |
|---|---|---|
| **AI Integration** | 30% | Claude claude-sonnet-4-20250514 vision API for defect analysis; structured JSON schema with RICS-aligned prompt engineering; JSON validation with auto-retry; Q&A feature using report context; session-level result caching for consistency |
| **Functionality** | 25% | End-to-end pipeline from image upload to exportable PDF report; portfolio comparison across multiple properties; HEIC support; defect zone overlay; severity-weighted priority ranking |
| **Code Quality** | 15% | TypeScript throughout; custom React hooks separating concerns; `imagesRef` pattern for async state correctness; null-safe rendering; serverless function with validation layer and timeout handling |
| **UI/UX** | 15% | Glassmorphism design system; per-image progress modal; severity gauge; interactive defect overlay with toggle; responsive layout; smooth Framer Motion transitions |
| **Documentation** | 15% | This README; inline code comments on all non-obvious architectural decisions; reflection document; demo video script |

---

## Team

| Name | Role |
|---|---|
| **Sameer Shaik** | Lead Engineer — architecture, full-stack implementation, AI integration, deployment |
| **Ryan** | Documentation — README, submission materials |
| **Aditya** | Presentation — slide deck, demo narrative |
| **Mason** | Feature development — Photo Comparison |
| **Razeen** | QA & Testing — cross-browser testing, bug reproduction |

---

## Responsible AI

SurveyAI is designed for **triage and prioritisation**, not as a replacement for a qualified Chartered Surveyor.

- Every report surfaces an **analysis limitations** field when image quality is insufficient
- All cost estimates are **indicative only** and recommend specialist engagement for formal assessment
- **RICS standards citations** are included in every report to ground outputs in professional frameworks
- **No images are stored** — files are processed in-session and discarded; nothing is persisted server-side
- The AI is explicitly instructed to **decline to fabricate** when it cannot make a confident assessment

---

## Acknowledgements

Built at the **Taurgo × Cardiff University AI Hackathon, March 2026**.

Powered by [Claude AI](https://anthropic.com) (Anthropic) · Deployed on [Netlify](https://netlify.com)

## License

© 2026 Sameer Shaik

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.

Commercial use of this software, its source code, or derivative works is **not permitted without explicit written permission from the author**.

See the LICENSE file for full details:
https://creativecommons.org/licenses/by-nc/4.0/
