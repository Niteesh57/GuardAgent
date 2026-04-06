"""
app/engines/chat_engine.py
Groq LLM tool-calling agent with Action Contract interception.

Pipeline per tool call:
  LLM decides to call tool
      ↓
  Permission Check (Token Vault)
      ↓ (if granted)
  CONTRACT GRAPH (for sensitive actions: send_email, read_calendar)
      ↓
  Return action_contract to frontend (user must Approve/Edit/Reject)
      OR
  Execute immediately (for read_emails — safe, non-destructive)
"""
import os
import json
from groq import AsyncGroq
from dotenv import load_dotenv
from app.engines.permission_engine import check_permission
from app.engines.intent_engine import execute_intent
from app.engines.graph.graph import run_to_contract
from app.services.action_logger import log_action

load_dotenv()

groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

# Actions that require a contract before execution (sensitive/destructive)
CONTRACT_REQUIRED_ACTIONS = {"send_email", "read_calendar", "create_calendar_event", "create_document", "edit_document", "template_document", "read_drive_file"}
# research_topic is safe (web search only) — executes immediately without a contract

# ── LLM Tool Definitions ────────────────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_emails",
            "description": "Read/search emails from the user's Gmail inbox. Use Gmail search syntax for the query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Gmail search query. Examples: 'is:unread', 'from:boss@example.com', 'subject:meeting', 'has:invite newer_than:5d'"
                    },
                    "max_results": {
                        "type": "string",
                        "description": "Maximum number of emails to return (default '5', max '10')"
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email on behalf of the user via Gmail. Always confirm with the user what to say before sending.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Recipient email address"},
                    "subject": {"type": "string", "description": "Email subject"},
                    "body": {"type": "string", "description": "Email body content (plain text)"},
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_calendar",
            "description": "Read upcoming calendar events from the user's Google Calendar.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {
                        "type": "string",
                        "description": "Number of days ahead to look for events (default '7')"
                    },
                    "max_results": {
                        "type": "string",
                        "description": "Maximum number of events to return (default '10')"
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Create a new calendar event. Always ask the user for event details (title, time, attendees) before calling this tool. Confirm the details with the user first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Event title/summary (e.g. 'Team Standup', 'Dinner with John')"
                    },
                    "start": {
                        "type": "string",
                        "description": "Event start time in ISO 8601 format (e.g. '2024-01-15T10:00:00')"
                    },
                    "end": {
                        "type": "string",
                        "description": "Event end time in ISO 8601 format (e.g. '2024-01-15T11:00:00'). If not provided, defaults to 1 hour after start."
                    },
                    "timezone": {
                        "type": "string",
                        "description": "Timezone (e.g. 'Asia/Kolkata', 'America/New_York'). Default: UTC"
                    },
                    "description": {
                        "type": "string",
                        "description": "Event description/notes (optional)"
                    },
                    "attendees": {
                        "type": "string",
                        "description": "Comma-separated list of attendee email addresses (optional, e.g. 'john@example.com,jane@example.com')"
                    },
            },
            "required": ["summary", "start"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_document",
            "description": "Create a new Google Doc with optional content. Use this when asked to create a document, write documentation, or start a new file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Document title (e.g. 'Project Proposal', 'Meeting Notes Q4')"
                    },
                    "content": {
                        "type": "string",
                        "description": "Initial content to add to the document (optional). Supports multiple paragraphs separated by newlines."
                    },
                    "format": {
                        "type": "string",
                        "description": "Format for the content: 'normal', 'heading1', 'heading2' (default: 'normal')"
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_document",
            "description": "Edit an existing Google Doc by adding or modifying content. Use this to update documentation, add sections, or insert new content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "The Google Doc document ID (from the URL: docs.google.com/document/d/DOCUMENT_ID/edit)"
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to add or insert into the document"
                    },
                    "section": {
                        "type": "string",
                        "description": "Optional: Section name to append content to (will search for this heading)"
                    },
                    "insert_at_start": {
                        "type": "string",
                        "description": "Insert at beginning of document instead of end (default: 'false')"
                    },
                    "format": {
                        "type": "string",
                        "description": "Format for the content: 'normal', 'heading1', 'heading2', 'heading3', 'bullet' (default: 'normal')"
                    },
                },
                "required": ["document_id", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "template_document",
            "description": "Create a professionally formatted document from a template. Use this when asked to create proposals, reports, meeting notes, project plans, or branded documents with specific sections and structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Document title (e.g. 'Q4 2024 Marketing Report', 'Project Apollo Proposal')"
                    },
                    "template_type": {
                        "type": "string",
                        "description": "Template type: 'proposal', 'report', 'meeting_notes', 'project_plan', or 'custom'"
                    },
                    "sections": {
                        "type": "string",
                        "description": "Comma-separated list of section names for custom templates (e.g. 'Introduction,Methodology,Results')"
                    },
                    "branding_text": {
                        "type": "string",
                        "description": "Branding text to add at the top (e.g. company name, team name)"
                    },
                    "ideas": {
                        "type": "string",
                        "description": "Comma-separated list of ideas or bullet points to include in an 'Ideas' section"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Additional notes or content to include at the end"
                    },
                },
                "required": ["title", "template_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_drive",
            "description": "Search for files in Google Drive. Returns file names and IDs. Use this to find a file before reading it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query (e.g., 'financial report', 'project specs', 'resume')"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_drive_file",
            "description": "Read the contents of specific files from Google Drive. You must provide the file IDs. The user will be asked to explicitly approve access to these files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of Google Drive file IDs to read"
                    }
                },
                "required": ["file_ids"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "research_topic",
            "description": "Search the web using Firecrawl to research a topic and return structured markdown content from multiple sources. Use this when the user asks to research a topic, create a well-documented school/college assignment, or create a document with researched content. Call this BEFORE creating a document.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "The topic or question to research (e.g. 'photosynthesis', 'World War 2 causes', 'machine learning fundamentals')"
                    },
                    "num_results": {
                        "type": "string",
                        "description": "Number of web sources to retrieve (default: '5', max: '8')"
                    }
                },
                "required": ["topic"]
            }
        }
    },
]

SYSTEM_PROMPT = """You are a highly capable AI personal assistant. You have DIRECT access to the user's Google Workspace through tools. You CAN and MUST use these tools - you are NOT simulating, you are actually connected.

AVAILABLE TOOLS:
- read_emails: Search and read emails from Gmail
- send_email: Compose and send emails via Gmail
- read_calendar: Check upcoming meetings and events from Google Calendar
- create_calendar_event: Create new calendar events
- create_document: Create a new Google Doc
- edit_document: Edit an existing Google Doc by adding content
- template_document: Create professional documents from templates (proposals, reports, meeting notes, project plans)
- search_drive: Search for files in Google Drive
- read_drive_file: Read specific files from Google Drive using their IDs
- research_topic: Search the web using Firecrawl and retrieve research content on a topic

CRITICAL RULES:
1. When asked about calendar/meetings/schedule/events, IMMEDIATELY call read_calendar
2. When asked about emails, IMMEDIATELY call read_emails
3. When asked to create/edit documents, use the documentation tools
4. You have real access to these services through your tools
5. When using tools, pass numeric parameters as strings

DOCUMENTATION CAPABILITIES:
You can create professional documentation including:
- Proposals with executive summary, problem statement, solution, timeline, budget
- Reports with introduction, methodology, findings, analysis, recommendations
- Meeting notes with attendees, agenda, discussion points, action items
- Project plans with objectives, scope, timeline, resources, risks
- Custom documents with any structure the user wants
- Documents with branding, headers, and formatted sections

CREATING DOCUMENTS - ASK FOR DETAILS FIRST:
When creating a document, ask:
1. What type of document? (proposal, report, meeting notes, project plan, custom)
2. What title?
3. Any specific sections needed?
4. Any branding (company/team name)?
5. Any ideas or content to include?

Then confirm before creating.

EDITING DOCUMENTS:
When asked to edit a document, use edit_document with the document_id and content.

TEMPLATES AVAILABLE:
- proposal: Executive Summary, Problem Statement, Proposed Solution, Timeline, Budget, Conclusion
- report: Introduction, Methodology, Findings, Analysis, Recommendations, Appendix
- meeting_notes: Date & Time, Attendees, Agenda, Discussion Points, Action Items, Next Steps
- project_plan: Project Overview, Objectives, Scope, Timeline, Resources, Risks, Milestones
- custom: User can specify any sections

EXAMPLES:
- User: "Create a project proposal for our new app" → Ask for details, then call template_document with template_type="proposal"
- User: "Write a report on Q3 sales" → Ask for details, then call template_document with template_type="report"
- User: "Add a conclusion section to my document" → Call edit_document with document_id and content in "conclusion" format
- User: "Create a document with introduction, methodology, and results" → Call template_document with template_type="custom" and sections

CALENDAR EVENTS:
When creating events, ask for details first, then confirm before calling create_calendar_event.

SIMPLE QUERIES - USE TOOLS DIRECTLY:
- "What meetings do I have?" → read_calendar with days_ahead="7"
- "Check my calendar for tomorrow" → read_calendar with days_ahead="1"
- "Any unread emails?" → read_emails with query="is:unread"
- "Get my drive files" / "Show my documents" → read_drive_file with file_ids=[] (triggers contract checkbox UI)
- "Find my resume and read it" → search_drive with query="resume", then read_drive_file with that ID


FETCHING / BROWSING DRIVE FILES:
When the user asks to "get drive files", "show me my files", "browse my Drive", or anything that implies file selection without specifying which files to read:
- DO NOT call `search_drive` and return a text list. That is WRONG.
- INSTEAD, immediately call `read_drive_file` with an EMPTY `file_ids` list: `file_ids=[]`.
- This will trigger the Action Contract UI which shows the user a beautiful checkbox list of ALL their Drive files to select from.
- The user will tick the files they want, then approve — only then will the content be read.
- You must NEVER dump a raw list of file names as text. Always use the contract UI.

`search_drive` is ONLY for internal lookups when you already know what file to look for by name/topic (e.g., "find my resume"). It should NEVER be the final response to the user for file browsing.


SUMMARIZING DOCUMENTS:
When you use `read_drive_file` and successfully retrieve a document's contents, DO NOT just dump or repeat the raw text back to the user. You MUST analyze the file and then provide a concise, readable summary. Frame your summary similarly to: "Here is a summary of the contents we have in [Document Name]: [Your concise summary...]"

RESEARCH-DRIVEN DOCUMENT CREATION:
When the user asks you to "research a topic and create a document", "write a school assignment", "write an essay on X", or anything that implies you should gather web information first, you MUST follow this strict two-step workflow:

STEP 1 — Research the topic:
  - Call `research_topic` with the user's topic as the query.
  - After receiving the results, synthesize the key information from all sources into a coherent outline with distinct sections (Introduction, Background, Key Concepts, Analysis, Conclusion, References, etc.).
  - DO NOT immediately call create_document yet; instead process and extract the most relevant content.

STEP 2 — Create the document with structured, well-styled content:
  - Call `template_document` (preferred) OR `create_document`.
  - The `notes` or `content` field MUST contain the full, well-structured research content you synthesized. Include:
    * A clear title with the topic name
    * Multiple organized sections with proper headings
    * Detailed, informative paragraphs under each heading (not just bullet points)
    * A References section listing the source URLs from the research results
  - The document must read like a professional academic paper or school submission — not a rough draft.

EXAMPLE:
- User: "Research quantum computing and create a document for my school project"
  1. Call research_topic with topic="quantum computing for school project"
  2. Synthesize results into: Introduction, What is Quantum Computing, Key Principles (Superposition, Entanglement, Interference), Applications, Challenges, Conclusion, References
  3. Call template_document with template_type="report" and notes containing all synthesized content
"""



async def run_chat_cycle(
    messages: list[dict],
    user_id: str,
    claims: dict,
    user_query: str = "",
) -> dict:
    """
    Multi-agent pipeline:
    1. LLM decides to call a tool
    2. Check permissions (Token Vault)
    3a. Sensitive action → generate Action Contract (pause for user approval)
    3b. Safe action (read_emails) → execute immediately
    """
    # Ensure system prompt is first
    if not messages or messages[0].get("role") != "system":
        messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})

    # Call Groq LLM - use OpenAI model for better tool calling
    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
    )

    response_message = response.choices[0].message

    # Build message dict for history
    msg_dict = {
        "role": response_message.role,
        "content": response_message.content,
    }
    if response_message.tool_calls:
        msg_dict["tool_calls"] = [
            {
                "id": tc.id,
                "type": tc.type,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                }
            } for tc in response_message.tool_calls
        ]

    messages.append(msg_dict)

    if not response_message.tool_calls:
        return {"messages": messages}

    # ── Process tool calls ─────────────────────────────────────────────────
    for tool_call in response_message.tool_calls:
        action = tool_call.function.name
        args = json.loads(tool_call.function.arguments)

        # Coerce types: LLM sometimes generates strings instead of integers
        if action == "read_emails":
            if "max_results" in args and isinstance(args["max_results"], str):
                args["max_results"] = int(args["max_results"])
        elif action == "read_calendar":
            if "days_ahead" in args and isinstance(args["days_ahead"], str):
                args["days_ahead"] = int(args["days_ahead"])
            if "max_results" in args and isinstance(args["max_results"], str):
                args["max_results"] = int(args["max_results"])

        # Step 1: Permission check
        perm = await check_permission(action, user_id)
        if not perm.get("granted"):
            log_action(
                user_id=user_id,
                action=action,
                status="permission_requested",
                service_used=perm.get("permission_request", {}).get("service", "unknown"),
                metadata={"reason": "Requested via Chat"},
            )
            return {
                "messages": messages,
                "permission_request": perm["permission_request"],
            }

        # Step 2: For sensitive actions → generate Action Contract (pause)
        if action in CONTRACT_REQUIRED_ACTIONS:
            contract = await run_to_contract(
                action=action,
                args=args,
                user_query=user_query or (
                    next(
                        (m["content"] for m in reversed(messages)
                         if m.get("role") == "user" and m.get("content")),
                        "perform this action"
                    )
                ),
                user_id=user_id,
            )
            log_action(
                user_id=user_id,
                action=action,
                status="contract_generated",
                service_used=perm.get("service", "unknown"),
                metadata={"contract_id": contract.get("contract_id")},
            )
            return {
                "messages": messages,
                "action_contract": contract,
            }

        # Step 3: Safe actions (read_emails) → execute immediately
        result = await execute_intent(
            action=action,
            data=args,
            user_id=user_id,
            confirmed=True,
        )

        if result.get("permission_request"):
            return {
                "messages": messages,
                "permission_request": result["permission_request"],
            }

        log_action(
            user_id=user_id,
            action=action,
            status=result.get("status", "unknown"),
            service_used=result.get("service", "unknown"),
            permissions_used=[perm.get("scope", "")],
            metadata={"result": result.get("result", {}), "error": result.get("error")},
        )

        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "name": action,
            "content": json.dumps(result),
        })

    # Let LLM summarize the tool result
    return await run_chat_cycle(messages, user_id, claims, user_query)
