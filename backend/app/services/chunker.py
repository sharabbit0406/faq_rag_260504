"""
Parent-child chunking strategy:
- Child  = one Q&A block from the parser (semantic unit, used for embedding & retrieval)
- Parent = group of consecutive Q&A blocks up to PARENT_SIZE tokens (sent to the LLM)

This keeps each Q&A pair intact so vector search gets a coherent semantic unit,
while the LLM receives the surrounding Q&As for broader context.

CSV/Excel rows: each row is already a semantic unit; child == parent.
"""
import tiktoken

_enc = None
PARENT_SIZE = 500   # max tokens per parent group
CHILD_SIZE = 400    # fallback: max tokens per child if a single block is too large


def _get_encoder():
    global _enc
    if _enc is None:
        _enc = tiktoken.get_encoding("cl100k_base")
    return _enc


def _token_len(text: str) -> int:
    return len(_get_encoder().encode(text))


def _split_by_tokens(text: str, size: int, overlap: int = 20) -> list[str]:
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


def chunk_blocks(blocks: list[dict], file_type: str) -> list[dict]:
    """
    Returns: [{"content": str, "parent_content": str, "metadata": dict}]
    content        — child chunk (one Q&A unit) embedded for retrieval
    parent_content — parent group (multiple Q&As) sent to LLM
    """
    if file_type in ("csv", "xlsx", "xls"):
        return [
            {"content": b["content"], "parent_content": b["content"], "metadata": b.get("metadata", {})}
            for b in blocks
        ]

    # Step 1: group blocks into parent groups (up to PARENT_SIZE tokens)
    parent_groups: list[list[dict]] = []
    current_group: list[dict] = []
    current_tokens = 0

    for block in blocks:
        text = block["content"]
        tlen = _token_len(text)

        if tlen >= PARENT_SIZE:
            # Flush current group, then handle oversized block separately
            if current_group:
                parent_groups.append(current_group)
                current_group = []
                current_tokens = 0
            parent_groups.append([block])
        elif current_tokens + tlen > PARENT_SIZE:
            parent_groups.append(current_group)
            current_group = [block]
            current_tokens = tlen
        else:
            current_group.append(block)
            current_tokens += tlen

    if current_group:
        parent_groups.append(current_group)

    # Step 2: for each group, each block becomes a child; the merged group is the parent
    result = []
    for group in parent_groups:
        parent_content = "\n\n".join(b["content"] for b in group)

        for block in group:
            content = block["content"]
            tlen = _token_len(content)

            if tlen > CHILD_SIZE:
                # Oversized single block — token-split into children, parent = the block
                for piece in _split_by_tokens(content, CHILD_SIZE):
                    result.append({
                        "content": piece,
                        "parent_content": content,
                        "metadata": block.get("metadata", {}),
                    })
            else:
                result.append({
                    "content": content,          # full Q&A block = child
                    "parent_content": parent_content,   # group of Q&As = parent
                    "metadata": block.get("metadata", {}),
                })

    return result
