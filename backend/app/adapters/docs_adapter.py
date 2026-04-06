"""
app/adapters/docs_adapter.py
Google Docs API operations for creating and editing documentation.
All functions accept a raw access_token (from Token Vault).
"""
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from typing import Optional


def _build_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("docs", "v1", credentials=creds)


async def create_document(access_token: str, data: dict) -> dict:
    """
    Create a new blank Google Doc.
    data: {
      "title": str  # Document title
    }
    Returns: { "document_id", "title", "url" }
    """
    service = _build_service(access_token)

    title = data.get("title", "Untitled Document")
    doc = service.documents().create(body={"title": title}).execute()

    doc_id = doc.get("documentId")
    return {
        "document_id": doc_id,
        "title": doc.get("title", title),
        "url": f"https://docs.google.com/document/d/{doc_id}/edit",
    }


async def get_document(access_token: str, data: dict) -> dict:
    """
    Get the latest version of a document.
    data: { "document_id": str }
    Returns: { "title", "body_content", "url" }
    """
    service = _build_service(access_token)

    doc_id = data["document_id"]
    doc = service.documents().get(documentId=doc_id).execute()

    title = doc.get("title", "")
    body = doc.get("body", {}).get("content", [])
    text = _extract_text(body)

    return {
        "document_id": doc_id,
        "title": title,
        "body_content": text,
        "url": f"https://docs.google.com/document/d/{doc_id}/edit",
    }


def _extract_text(content: list) -> str:
    """Extract plain text from document body content."""
    text_parts = []
    for element in content:
        paragraph = element.get("paragraph")
        if paragraph:
            elements = paragraph.get("elements", [])
            for elem in elements:
                text_run = elem.get("textRun")
                if text_run:
                    text_parts.append(text_run.get("content", ""))
            text_parts.append("\n")
        table = element.get("table")
        if table:
            for row in table.get("tableRows", []):
                for cell in row.get("tableCells", []):
                    cell_content = cell.get("content", [])
                    text_parts.append(_extract_text(cell_content))
                    text_parts.append("\t")
                text_parts.append("\n")
    return "".join(text_parts).strip()


async def create_document_from_template(access_token: str, data: dict) -> dict:
    """
    Create a new document with pre-formatted template content.
    data: {
      "title": str,
      "template_type": str,  # "proposal", "report", "meeting_notes", "project_plan", "custom"
      "sections": list,      # Custom sections for custom template
      "branding": dict,      # { "logo_text": str, "accent_color": str }
      "content": dict        # { "ideas": list, "notes": str }
    }
    """
    service = _build_service(access_token)

    title = data.get("title", "Untitled Document")
    template_type = data.get("template_type", "report")
    branding = data.get("branding", {})
    content = data.get("content", {})

    # Create blank document
    doc = service.documents().create(body={"title": title}).execute()
    doc_id = doc.get("documentId")

    # Generate template content based on type
    requests = _build_template_requests(template_type, branding, content, data.get("sections", []))

    if requests:
        service.documents().batchUpdate(
            documentId=doc_id,
            body={"requests": requests}
        ).execute()

    return {
        "document_id": doc_id,
        "title": title,
        "template_type": template_type,
        "url": f"https://docs.google.com/document/d/{doc_id}/edit",
    }


def _build_template_requests(template_type: str, branding: dict, content: dict, sections: list) -> list:
    """Build batch update requests for document formatting."""
    requests = []

    # Template structures
    templates = {
        "proposal": {
            "header": "PROPOSAL",
            "sections": ["Executive Summary", "Problem Statement", "Proposed Solution", "Timeline", "Budget", "Conclusion"]
        },
        "report": {
            "header": "REPORT",
            "sections": ["Introduction", "Methodology", "Findings", "Analysis", "Recommendations", "Appendix"]
        },
        "meeting_notes": {
            "header": "MEETING NOTES",
            "sections": ["Date & Time", "Attendees", "Agenda", "Discussion Points", "Action Items", "Next Steps"]
        },
        "project_plan": {
            "header": "PROJECT PLAN",
            "sections": ["Project Overview", "Objectives", "Scope", "Timeline", "Resources", "Risks", "Milestones"]
        },
    }

    template = templates.get(template_type, templates["report"])

    # If custom sections provided, use those instead
    if sections:
        template_sections = sections
    else:
        template_sections = template["sections"]

    # Build content index
    index = 1

    # Add branding/header if provided
    brand_text = branding.get("logo_text", "")
    if brand_text:
        requests.append({
            "insertText": {
                "location": {"index": index},
                "text": f"{brand_text}\n"
            }
        })
        # Make it a title style
        requests.append({
            "updateParagraphStyle": {
                "range": {
                    "startIndex": index,
                    "endIndex": index + len(brand_text) + 1
                },
                "paragraphStyle": {
                    "namedStyleType": "TITLE"
                },
                "fields": "namedStyleType"
            }
        })
        index += len(brand_text) + 1

    # Add document header
    header = template["header"]
    date_str = "Created: " + __import__("datetime").datetime.now().strftime("%B %d, %Y")

    requests.append({
        "insertText": {
            "location": {"index": index},
            "text": f"{header}\n{date_str}\n\n"
        }
    })

    # Style the header
    requests.append({
        "updateParagraphStyle": {
            "range": {
                "startIndex": index,
                "endIndex": index + len(header)
            },
            "paragraphStyle": {
                "namedStyleType": "HEADING_1"
            },
            "fields": "namedStyleType"
        }
    })
    index += len(header) + 1 + len(date_str) + 2

    # Add sections
    for section in template_sections:
        section_text = f"{section}\n"

        requests.append({
            "insertText": {
                "location": {"index": index},
                "text": section_text
            }
        })

        # Style as heading
        requests.append({
            "updateParagraphStyle": {
                "range": {
                    "startIndex": index,
                    "endIndex": index + len(section_text)
                },
                "paragraphStyle": {
                    "namedStyleType": "HEADING_2"
                },
                "fields": "namedStyleType"
            }
        })
        index += len(section_text)

        # Add placeholder text
        placeholder = "[Your content here]\n\n"
        requests.append({
            "insertText": {
                "location": {"index": index},
                "text": placeholder
            }
        })

        # Style placeholder with italic
        requests.append({
            "updateTextStyle": {
                "range": {
                    "startIndex": index,
                    "endIndex": index + len(placeholder) - 2
                },
                "textStyle": {
                    "italic": True,
                    "foregroundColor": {
                        "color": {
                            "rgbColor": {
                                "red": 0.5,
                                "green": 0.5,
                                "blue": 0.5
                            }
                        }
                    }
                },
                "fields": "italic,foregroundColor"
            }
        })
        index += len(placeholder)

    # Add user ideas/notes if provided
    ideas = content.get("ideas", [])
    notes = content.get("notes", "")

    if ideas:
        ideas_header = "IDEAS & NOTES\n"
        requests.append({
            "insertText": {
                "location": {"index": index},
                "text": ideas_header
            }
        })
        requests.append({
            "updateParagraphStyle": {
                "range": {
                    "startIndex": index,
                    "endIndex": index + len(ideas_header)
                },
                "paragraphStyle": {
                    "namedStyleType": "HEADING_2"
                },
                "fields": "namedStyleType"
            }
        })
        index += len(ideas_header)

        for i, idea in enumerate(ideas):
            idea_text = f"• {idea}\n"
            requests.append({
                "insertText": {
                    "location": {"index": index},
                    "text": idea_text
                }
            })
            index += len(idea_text)

    if notes:
        notes_text = f"\n{notes}\n"
        requests.append({
            "insertText": {
                "location": {"index": index},
                "text": notes_text
            }
        })
        requests.append({
            "updateTextStyle": {
                "range": {
                    "startIndex": index,
                    "endIndex": index + len(notes_text)
                },
                "textStyle": {
                    "italic": True
                },
                "fields": "italic"
            }
        })

    return requests


async def edit_document(access_token: str, data: dict) -> dict:
    """
    Edit an existing document by inserting text at specific locations.
    data: {
      "document_id": str,
      "content": str,           # Text to insert
      "section": str,           # Section name to append to (optional)
      "insert_at_start": bool,  # Insert at beginning (default: append at end)
      "format": str             # "normal", "heading1", "heading2", "heading3", "bullet"
    }
    """
    service = _build_service(access_token)

    doc_id = data["document_id"]
    content = data.get("content", "")
    format_type = data.get("format", "normal")
    insert_at_start = data.get("insert_at_start", False)

    if not content:
        return {"error": "No content provided", "document_id": doc_id}

    # Get document to find insertion point
    doc = service.documents().get(documentId=doc_id).execute()
    body = doc.get("body", {}).get("content", [])

    # Find insertion index
    if insert_at_start:
        # Insert after title (typically index 1)
        insert_index = 1
        if body:
            first_element = body[0]
            paragraph = first_element.get("paragraph", {})
            elements = paragraph.get("elements", [])
            if elements:
                text_run = elements[0].get("textRun", {})
                insert_index = len(text_run.get("content", ""))
    else:
        # Insert at end
        insert_index = body[-1].get("endIndex", 1) - 1 if body else 1

    requests = []

    # Insert text
    requests.append({
        "insertText": {
            "location": {"index": insert_index},
            "text": content + "\n"
        }
    })

    # Apply formatting
    if format_type != "normal":
        style_map = {
            "heading1": "HEADING_1",
            "heading2": "HEADING_2",
            "heading3": "HEADING_3",
            "title": "TITLE",
            "subtitle": "SUBTITLE",
        }

        named_style = style_map.get(format_type)
        if named_style:
            requests.append({
                "updateParagraphStyle": {
                    "range": {
                        "startIndex": insert_index,
                        "endIndex": insert_index + len(content)
                    },
                    "paragraphStyle": {
                        "namedStyleType": named_style
                    },
                    "fields": "namedStyleType"
                }
            })
        elif format_type == "bullet":
            requests.append({
                "createParagraphBullets": {
                    "range": {
                        "startIndex": insert_index,
                        "endIndex": insert_index + len(content)
                    },
                    "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE"
                }
            })

    if requests:
        service.documents().batchUpdate(
            documentId=doc_id,
            body={"requests": requests}
        ).execute()

    return {
        "document_id": doc_id,
        "title": doc.get("title", ""),
        "content_added": content[:100] + "..." if len(content) > 100 else content,
        "url": f"https://docs.google.com/document/d/{doc_id}/edit",
    }


async def add_section(access_token: str, data: dict) -> dict:
    """
    Add a new section with header and content to a document.
    data: {
      "document_id": str,
      "header": str,
      "content": str,
      "header_level": int  # 1, 2, or 3 (default: 2)
    }
    """
    service = _build_service(access_token)

    doc_id = data["document_id"]
    header = data.get("header", "")
    content = data.get("content", "")
    header_level = data.get("header_level", 2)

    # Get document end index
    doc = service.documents().get(documentId=doc_id).execute()
    body = doc.get("body", {}).get("content", [])
    insert_index = body[-1].get("endIndex", 1) - 1 if body else 1

    requests = []
    full_text = f"\n{header}\n{content}\n"

    requests.append({
        "insertText": {
            "location": {"index": insert_index},
            "text": full_text
        }
    })

    # Style header
    header_style = f"HEADING_{header_level}"
    header_start = insert_index + 1  # Skip the leading newline
    header_end = header_start + len(header)

    requests.append({
        "updateParagraphStyle": {
            "range": {
                "startIndex": header_start,
                "endIndex": header_end
            },
            "paragraphStyle": {
                "namedStyleType": header_style
            },
            "fields": "namedStyleType"
        }
    })

    if requests:
        service.documents().batchUpdate(
            documentId=doc_id,
            body={"requests": requests}
        ).execute()

    return {
        "document_id": doc_id,
        "section_added": header,
        "content_length": len(content),
        "url": f"https://docs.google.com/document/d/{doc_id}/edit",
    }
