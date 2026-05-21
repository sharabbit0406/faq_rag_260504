"""
Parse uploaded files into a list of raw text blocks.
Returns: list of {"content": str, "metadata": dict}
"""
import io
import re
import pandas as pd
import fitz  # PyMuPDF

# Matches lines that start a new Q&A question.
# Handles: Q1： Q2： Q： (numbered or bare) with optional leading bullet ● or •
# Does NOT match numbered list items inside answers (e.g. "1. 卓越執行力")
_Q_PATTERN = re.compile(
    r"(?m)^\s*(?:[●•]\s*)?Q\d*[：:]",
)


def _split_by_qa(text: str) -> list[str]:
    """Split text into Q&A segments. Falls back to paragraph split if no Q markers found."""
    matches = list(_Q_PATTERN.finditer(text))
    if not matches:
        return [p.strip() for p in text.split("\n\n") if p.strip()]

    segments = []
    preamble = text[: matches[0].start()].strip()
    if preamble:
        segments.append(preamble)
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        seg = text[m.start() : end].strip()
        if seg:
            segments.append(seg)
    return segments


def parse_pdf(content: bytes) -> list[dict]:
    doc = fitz.open(stream=content, filetype="pdf")
    # Collect all pages into one text, preserving page boundaries with a sentinel
    all_text = ""
    page_boundaries: list[tuple[int, int]] = []  # (char_start, page_num)
    for page_num, page in enumerate(doc):
        start = len(all_text)
        text = page.get_text("text").strip()
        if text:
            page_boundaries.append((start, page_num + 1))
            all_text += text + "\n\n"

    if not all_text.strip():
        return []

    segments = _split_by_qa(all_text)

    def _page_for(char_pos: int) -> int:
        page = 1
        for start, pnum in page_boundaries:
            if char_pos >= start:
                page = pnum
        return page

    blocks = []
    pos = 0
    for seg in segments:
        idx = all_text.find(seg, pos)
        if idx == -1:
            idx = pos
        blocks.append({"content": seg, "metadata": {"page": _page_for(idx)}})
        pos = idx + len(seg)
    return blocks


def parse_csv(content: bytes) -> list[dict]:
    df = pd.read_csv(io.BytesIO(content))
    blocks = []
    cols = df.columns.tolist()
    q_col = next((c for c in cols if "q" in c.lower() or "question" in c.lower()), cols[0] if cols else None)
    a_col = next((c for c in cols if "a" in c.lower() or "answer" in c.lower()), cols[1] if len(cols) > 1 else None)

    for i, row in df.iterrows():
        if a_col:
            answer = str(row[a_col]).strip()
            question = str(row[q_col]).strip() if q_col else ""
            if answer and answer != "nan":
                blocks.append({
                    "content": answer,
                    "metadata": {"question": question, "source_row": int(i) + 1},
                })
        else:
            text = " ".join(str(v) for v in row.values if str(v) != "nan").strip()
            if text:
                blocks.append({"content": text, "metadata": {"source_row": int(i) + 1}})
    return blocks


def parse_excel(content: bytes) -> list[dict]:
    df = pd.read_excel(io.BytesIO(content))
    return parse_csv(df.to_csv(index=False).encode())


def parse_txt(content: bytes) -> list[dict]:
    text = content.decode("utf-8", errors="ignore")
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    return [{"content": p, "metadata": {}} for p in paragraphs]


def parse_file(content: bytes, file_type: str) -> list[dict]:
    parsers = {
        "pdf": parse_pdf,
        "csv": parse_csv,
        "xlsx": parse_excel,
        "xls": parse_excel,
        "txt": parse_txt,
    }
    parser = parsers.get(file_type)
    if not parser:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser(content)
