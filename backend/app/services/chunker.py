"""
Split parsed blocks into indexable chunks using parent-child strategy.
- Parent chunks (~500 tokens): rich context sent to the LLM
- Child chunks (~100 tokens): small segments embedded for precise retrieval
Each child carries its parent_content so the LLM always sees the full context.

CSV/Excel rows: no splitting needed (already one record per row).
"""
import tiktoken

_enc = None
PARENT_SIZE = 500
CHILD_SIZE = 100
CHILD_OVERLAP = 20


def _get_encoder():
    global _enc
    if _enc is None:
        _enc = tiktoken.get_encoding("cl100k_base")
    return _enc


def _token_len(text: str) -> int:
    return len(_get_encoder().encode(text))


def _split_by_tokens(text: str, size: int, overlap: int) -> list[str]:
    enc = _get_encoder()
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + size, len(tokens))
        chunks.append(enc.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start += size - overlap
    return chunks


def _make_parents(blocks: list[dict]) -> list[dict]:
    """Group blocks into parent chunks (~PARENT_SIZE tokens)."""
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

        if tlen >= PARENT_SIZE:
            flush()
            group_texts, group_tokens, group_meta = [], 0, {}
            for i, piece in enumerate(_split_by_tokens(text, PARENT_SIZE, CHILD_OVERLAP)):
                result.append({"content": piece, "metadata": {**meta, "sub_chunk": i}})
        elif group_tokens + tlen > PARENT_SIZE:
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


def chunk_blocks(blocks: list[dict], file_type: str) -> list[dict]:
    """
    Returns: [{"content": str, "parent_content": str, "metadata": dict}]
    content       — small child chunk (~100 tokens) used for embedding/retrieval
    parent_content — full parent chunk (~500 tokens) sent to the LLM for context
    """
    if file_type in ("csv", "xlsx", "xls"):
        return [{"content": b["content"], "parent_content": b["content"], "metadata": b.get("metadata", {})} for b in blocks]

    parents = _make_parents(blocks)
    result = []
    for parent in parents:
        parent_content = parent["content"]
        parent_tokens = _token_len(parent_content)

        if parent_tokens <= CHILD_SIZE:
            # Parent is already small — child == parent
            result.append({
                "content": parent_content,
                "parent_content": parent_content,
                "metadata": parent.get("metadata", {}),
            })
        else:
            children = _split_by_tokens(parent_content, CHILD_SIZE, CHILD_OVERLAP)
            for child in children:
                result.append({
                    "content": child,
                    "parent_content": parent_content,
                    "metadata": parent.get("metadata", {}),
                })

    return result
