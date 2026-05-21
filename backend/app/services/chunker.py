"""
Split parsed blocks into indexable chunks.
- CSV/Excel rows: already 1 chunk per row (from parser)
- PDF/TXT: paragraph-aware grouping — never cuts inside a paragraph.
  Consecutive paragraphs are merged until approaching CHUNK_SIZE tokens.
  A single oversized paragraph is split by tokens as a last resort.
"""
import tiktoken

_enc = None
CHUNK_SIZE = 500
OVERLAP = 50


def _get_encoder():
    global _enc
    if _enc is None:
        _enc = tiktoken.get_encoding("cl100k_base")
    return _enc


def _token_len(text: str) -> int:
    return len(_get_encoder().encode(text))


def _split_by_tokens(text: str) -> list[str]:
    """Fallback: split a single oversized paragraph by token window."""
    enc = _get_encoder()
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunks.append(enc.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start += CHUNK_SIZE - OVERLAP
    return chunks


def chunk_blocks(blocks: list[dict], file_type: str) -> list[dict]:
    """
    Returns: [{"content": str, "metadata": dict}]
    """
    if file_type in ("csv", "xlsx", "xls"):
        return blocks

    # PDF / TXT: group paragraphs up to CHUNK_SIZE; never split within a paragraph.
    result = []
    group_texts: list[str] = []
    group_tokens = 0
    group_meta: dict = {}

    def flush():
        if group_texts:
            result.append({
                "content": "\n\n".join(group_texts),
                "metadata": group_meta,
            })

    for block in blocks:
        text = block["content"]
        meta = block.get("metadata", {})
        tlen = _token_len(text)

        if tlen >= CHUNK_SIZE:
            # Flush current group before handling oversized paragraph
            flush()
            group_texts, group_tokens, group_meta = [], 0, {}
            # Split the big paragraph by tokens (rare fallback)
            for i, piece in enumerate(_split_by_tokens(text)):
                result.append({"content": piece, "metadata": {**meta, "sub_chunk": i}})
        elif group_tokens + tlen > CHUNK_SIZE:
            # Current group is full — flush and start fresh
            flush()
            group_texts = [text]
            group_tokens = tlen
            group_meta = meta
        else:
            if not group_texts:
                group_meta = meta
            group_texts.append(text)
            group_tokens += tlen

    flush()
    return result
