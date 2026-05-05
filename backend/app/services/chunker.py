"""
Split parsed blocks into indexable chunks.
- CSV/Excel rows: already 1 chunk per row (from parser)
- PDF/TXT: fixed-size token window with overlap
"""
import tiktoken

_enc = None


def _get_encoder():
    global _enc
    if _enc is None:
        _enc = tiktoken.get_encoding("cl100k_base")
    return _enc


def _split_by_tokens(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    enc = _get_encoder()
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(enc.decode(chunk_tokens))
        if end == len(tokens):
            break
        start += chunk_size - overlap
    return chunks


def chunk_blocks(blocks: list[dict], file_type: str) -> list[dict]:
    """
    Returns: [{"content": str, "metadata": dict}]
    """
    if file_type in ("csv", "xlsx", "xls"):
        # Each row is already one chunk
        return blocks

    # PDF / TXT: token-based splitting
    result = []
    for block in blocks:
        splits = _split_by_tokens(block["content"])
        for i, text in enumerate(splits):
            result.append({
                "content": text,
                "metadata": {**block.get("metadata", {}), "sub_chunk": i},
            })
    return result
