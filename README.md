# Guard Agent with Groq LLM & Auth0 Token Vault

A secure execution + decision orchestrator that acts on your behalf using **zero local fallbacks**. 

## Architecture
- **Frontend (Next.js SPA):** Pure client-side React app. Uses `@auth0/auth0-react` for login. **No OAuth secrets exist in the frontend.** The frontend provides a conversational Chat UI.
- **Backend (FastAPI):** Powered by Groq LLM tool-calling. It natively orchestrates permissions out-of-band by returning authorization requests to the frontend when tokens in the Auth0 Token Vault are missing.
- **Authentication:** All third-party secrets (Google Calendar, Gmail, etc.) are managed securely by the Auth0 Token Vault.

## Setup Instructions

### 1. Auth0 Dashboard Configuration
1. **Create an API:**
   - Name: `Guard Agent API`
   - Identifier/Audience: `https://guard-agent-api`
   - Signing Alg: RS256
2. **Create a Single Page Application (SPA):**
   - Name: `Guard Agent Frontend`
   - Allowed Callback URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
   - Allowed Logout URLs: `http://localhost:3000`
3. **Create a Machine-to-Machine (M2M) Application:**
   - To let the backend read the Token Vault, create an M2M app.
   - Authorize it for the **Auth0 Management API**.
   - Grant the `read:users` and `read:user_idp_tokens` scopes.
4. **Configure Social Connections (Token Vault):**
   - Go to Authentication -> Social -> Google.
   - Enable the Google connection and **turn on the Token Vault** (Allow checking for stored credentials).
   - Ensure the Google connection requests scopes for Gmail (`https://www.googleapis.com/auth/gmail.send`) and Calendar (`https://www.googleapis.com/auth/calendar`).

### 2. Configure Backend (.env)
Copy `backend/.env.example` to `backend/.env` and fill it in:
- `AUTH0_DOMAIN` (e.g., `your-tenant.us.auth0.com`)
- `AUTH0_AUDIENCE` (`https://guard-agent-api`)
- `AUTH0_MGMT_CLIENT_ID` and `AUTH0_MGMT_CLIENT_SECRET` (from step 1.3)
- `GROQ_API_KEY`

### 3. Configure Frontend (.env.local)
Copy `frontend/.env.local.example` to `frontend/.env.local`:
- `NEXT_PUBLIC_AUTH0_DOMAIN`
- `NEXT_PUBLIC_AUTH0_CLIENT_ID` (from step 1.2)
- `NEXT_PUBLIC_AUTH0_AUDIENCE` (`https://guard-agent-api`)
- `NEXT_PUBLIC_API_URL` (`http://localhost:8000`)

### 4. Run the Apps
```bash
# Backend (Terminal 1)
cd backend
python -m venv venv
venv\Scripts\activate   # (Windows)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Login via Auth0, and begin chatting with your Groq persona!

---

## 🧠 Core Feature: Selective Scope Authorization

***(Aka: User-Curated Permissions or Granular Resource Pledging)***

### 🔥 The Idea

Instead of the standard OAuth approach:
❌ *“Allow this AI to access all your files in Google Drive”*

You give the user control at the file level:
✅ *“Allow this AI to access THESE 3 specific documents only”*

### 🧩 How It Fits This System

The Guard Agent already has:
*   Action Contracts ✅
*   Auth0 Token Vault ✅
*   Negotiable Permissions ✅

Now it adds **Resource-Level Control**.

### 🧠 The New Permission Layer

**Before (Normal OAuth):**
```json
{
  "scope": "https://www.googleapis.com/auth/drive.readonly"
}
```

**After (YOUR SYSTEM):**
```json
{
  "scope": "https://www.googleapis.com/auth/drive.readonly",
  "allowed_resources": [
    "fileId_1A2B3C4D5E",
    "fileId_9Z8Y7X6W5V"
  ]
}
```

### 🔥 Example Action Contract (Demo GOLD)

**User says:**
*“Summarize the Q3 financial reports for me.”*

**Agent shows in UI:**

> 📜 **ACTION CONTRACT**
> 
> I need to read files from your Google Drive to summarize the reports.
> 
> **Select what I can access:**
> 
> [✓] Q3_Financial_Draft.pdf  
> [✓] Q3_Expense_Sheet.xlsx  
> [ ] Q4_Projections_CONFIDENTIAL.pdf  
> [ ] Personal_Journal_2026.docx  
> 
> **Scope:**
> *   Read selected files only
> 
> **Do you approve?**

### 🤯 Why This Is HUGE
*   **Today:** OAuth requires users to hand over the keys to their entire digital life (all or nothing). Users don't use agents because they don't trust them with their entire Drive.
*   **Your System:** Absolute privacy, absolute trust—wrapping standard OAuth with a user-controlled filtering layer.

### 🔐 How It Is Implemented

We **do not** modify Google OAuth. Instead, we build a **Permission Filter Layer**.

1. **OAuth:** Google gives our backend a raw token with full `drive.readonly` access.
2. **Token Vault:** We store this in the Auth0 Token Vault.
3. **Execution Filter:** Before the AI uses the token to hit `googleapis.com/drive/v3/files/{fileId}`, our system intercepts it:

```javascript
// Example Middleware for the Drive API
const requestedFileId = request.params.fileId;
const allowedList = TokenVault.getAllowedResources(userId, "google_drive");

if (!allowedList.includes(requestedFileId)) {
  return blockAccess("Error: AI Agent is not authorized to read this specific file.");
}
return forwardRequestToGoogleDrive(request);
```

You are wrapping OAuth with an application-level constraint engine, allowing the agent to safely reason about its limitations.
