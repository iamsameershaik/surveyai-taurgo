# Taurgo: AI-Powered Property Inspection

**Taurgo** is an intelligent automation platform designed to accelerate and simplify the property survey process. By leveraging advanced Computer Vision and Generative AI, the system transforms raw images of property damage into professionally structured **RICS (Royal Institution of Chartered Surveyors)** compliant reports in seconds.

---

## Overview
The application follows a 4-step linear pipeline to move from a visual observation to a professional recommendation:

1.  **Image Ingestion:** Accepts high-resolution uploads of property defects.
2.  **Visual Analysis:** Processes images using **Claude Vision** to identify material defects, moisture, or structural issues.
3.  **Data Synthesis:** Extracted findings are fed into the **Claude 4.5 Sonnet** model to categorize observations and assess risk.
4.  **Report Generation:** Produces a structured RICS survey report complete with severity ratings and actionable next steps.

---

## Tech Stack
| Component | Technology |
| :--- | :--- |
| **Frontend** | React.js |
| **Backend** | Netlify |
| **Computer Vision** | Claude Vision |
| **Generative AI** | Claude 4.5 Sonnet |

---

## How To Use

### 1. Upload Image
* Locate the upload zone on the dashboard.
* **Drag and drop** your inspection photos into the box.
* **Supported Formats:** `.jpg` or `.png`

### 2. Generate Report
* Click the **"Analyse Image"** button to trigger the AI pipeline.
* Please wait while the loading indicator is active; the AI is currently cross-referencing visual data with RICS reporting standards.
* Once processing is complete, scroll down to review the results.

### 3. View Report
The completed report provides a deep dive into three critical areas:
*  **Risk:** Immediate threats to structural integrity or safety.
*  **Cost to Repair:** A preliminary estimate for mitigation.
*  **Suggested Next Actions:** Professional recommendations (e.g., "Consult a structural engineer" or "Immediate damp proofing required").

---