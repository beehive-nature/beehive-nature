"""Reviewed job recipes. Email/model output cannot extend this registry."""
import ast
import hashlib
import re
from pathlib import Path

REPO_URL = "https://github.com/beehive-nature/beehive-nature.git"
PATH = "scripts/buzz-mail/triage.py"
START = "def extract(raw):"
END = "\n\ndef validate_result"
RECIPE = "mail-attachment-boundary-v1"
INSTRUCTION = """Repair only extract(raw). Its message.walk() traversal leaks text
from attached messages and attached multipart containers into the model prompt.
Recursively visit multipart containers, but skip any subtree with an attachment
disposition or a filename. Never descend into message/rfc822. Preserve ordinary
text/plain bodies and inline multipart/alternative handling, the sensitive-mail
check, format_review, subject/body limits, JSON return shape, and all other behavior.
Use existing imports. Return JSON with exactly one string field named replacement,
containing the complete replacement def extract(raw) function. No markdown fences,
no other functions at module scope, no instructions to the operator."""


def valid_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,60}", value):
        raise ValueError("invalid_job_id")
    return value


def valid_sha(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("invalid_commit")
    return value


def region(source):
    if source.count(START) != 1 or source.count(END) != 1:
        raise ValueError("source_region_ambiguous")
    begin, end = source.index(START), source.index(END)
    if end <= begin:
        raise ValueError("source_region_order")
    return source[begin:end]


def replacement(value):
    if not isinstance(value, dict) or set(value) != {"replacement"}:
        raise ValueError("patch_schema")
    code = value["replacement"]
    if not isinstance(code, str) or not code.startswith(START) or len(code) > 12000:
        raise ValueError("patch_shape")
    tree = ast.parse(code)
    if len(tree.body) != 1 or not isinstance(tree.body[0], ast.FunctionDef) or tree.body[0].name != "extract":
        raise ValueError("patch_scope")
    return code.rstrip()


def apply(worktree, old_hash, new):
    root = Path(worktree).resolve()
    path = root / PATH
    if path.is_symlink() or not path.resolve().is_relative_to(root):
        raise ValueError("patch_path")
    source = path.read_text()
    old = region(source)
    if hashlib.sha256(old.encode()).hexdigest() != old_hash:
        raise ValueError("source_changed")
    code = replacement({"replacement": new})
    updated = source.replace(old, code, 1)
    ast.parse(updated)
    path.write_text(updated)
