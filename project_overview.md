# 🛡️ Guard Agent: The Secure AI Automation Framework

Built for the **Auth0 for AI Agents: Authorized to Act Hackathon**, Guard Agent is a high-security, autonomous research and automation platform designed to bridge the gap between powerful LLM agents and secure enterprise/personal data.

> [!IMPORTANT]
> **Pushing the boundaries of what AI agents can do and become.**
> Guard Agent creates a "Trust Orchestrator" where users can safely delegate complex tasks while maintaining absolute control over their data, powered by the **Auth0 for AI Agents Token Vault**.

---

## 🏗️ The 3-Agent Security Pipeline (LangGraph)

Guard Agent operates on a stateful, multi-agent graph architecture that enforces human-in-the-loop consent at every sensitive step.

| Agent | Role | Responsibility |
| :--- | :--- | :--- |
| **1. IntentNode** | **Planner** | Analyzes requests, researches topics (via Firecrawl), and determines tool-calling strategy. |
| **2. ContractNode** | **Safety Officer** | Generates human-readable **Action Contracts** and provides granular resource selection. |
| **3. ExecutorNode** | **Secure Worker** | Executes actions ONLY after verified consent, retrieving secrets from **Auth0 Token Vault**. |

---

## 📐 Architecture & Communication Flow

```mermaid
sequenceDiagram
    participant User as User (Browser)
    participant Agent as Guard Agent (Backend)
    participant Auth0 as Auth0 Token Vault
    participant API as Third-Party API (Google Docs/Drive)

    User->>Agent: "User Request (Research and save to Doc)"
    
    rect rgb(30, 30, 30)
        Note over Agent: IntentNode (Planning)
        Agent->>Agent: Internal Research
    end

    rect rgb(50, 30, 30)
        Note over Agent: ContractNode (Safety/Consent)
        Agent->>Auth0: Fetch Resource Metadata
        Auth0-->>Agent: Drive File Metadata
        Agent-->>User: "Return Action Contract + File Selection UI"
    end

    Note over User, Agent: Execution Paused: Waiting for User Consent

    User->>Agent: "Approve Contract (Files Selected: A, B)"

    rect rgb(30, 50, 30)
        Note over Agent: ExecutorNode (Secure Action)
        Agent->>Auth0: Request Scoped Access Token
        Auth0-->>Agent: OAuth Token
        Agent->>API: "Execute Action (Document Created)"
        API-->>Agent: Result
    end

    Agent-->>User: "Task Complete (Summarized output)"
```

---

## 📋 The Anatomy of an Action Contract

The **Action Contract** is the cornerstone of our trust model. It is generated dynamically and includes:

*   **Human-Readable Intent**: Clear goals (e.g., "Create a formatted Project Proposal").
*   **Step-by-Step Execution Plan**: Detailed breakdown of actions.
*   **Risk Level Assessment**: Categorizes actions (**Low, Medium, High**).
*   **Data Boundaries**: Explicitly lists **Data Used** and **Data NOT Used**.
*   **Selective Resource Picker**: Dynamic selection of exactly which files the agent can access.

---

## 🛡️ Security Architecture (Auth0 Integration)

### 1. Auth0 Token Vault: "Zero Secrets in the Browser"
We utilize the **Auth0 Token Vault** to eliminate local credential storage. 
- **Secret Management**: Google OAuth tokens are stored **exclusively** in Auth0's encrypted backend vault.
- **Short-Lived Access**: The backend retrieves tokens only for the duration of an approved action.

### 2. Selective Scope Authorization (SSA)
Traditional OAuth is "All-or-Nothing". SSA allows the user to grant access to **exactly the resources needed** for a specific task, ensuring the principle of least privilege.

---

## 🧪 Technology Stack

*   **Orchestration**: LangChain & LangGraph (Python).
*   **Inference**: Groq (Llama 3 @ 70B) for ultra-low latency planning.
*   **Identity**: Auth0 (OIDC) + **Auth0 Token Vault (Secret Management)**.
*   **Frontend**: Next.js (Tailwind + Framer Motion).
*   **Research**: Firecrawl & Jina.
