"""
Parse uploaded files into a list of raw text blocks.
Returns: list of {"content": str, "metadata": dict}
"""
import io
import pandas as pd
import fitz  # PyMuPDF


def parse_pdf(content: bytes) -> list[dict]:
    doc = fitz.open(stream=content, filetype="pdf")
    blocks = []
    for page_num, page in enumerate(doc):
        text = page.get_text("text").strip()
        if text:
            blocks.append({"content": text, "metadata": {"page": page_num + 1}})
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
    return [{"content": text, "metadata": {}}]


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
