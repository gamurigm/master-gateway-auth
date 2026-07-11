from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from transformers import AutoConfig, AutoModel, AutoModelForSequenceClassification, AutoTokenizer


DEFAULT_MODEL = "mrm8488/codebert-base-finetuned-detect-insecure-code"
DEFAULT_THRESHOLD = float(os.getenv("CODEBERT_THRESHOLD", "0.999"))
SOURCE_EXTENSIONS = {
    ".c",
    ".cc",
    ".cpp",
    ".cxx",
    ".h",
    ".hpp",
    ".java",
    ".js",
    ".jsx",
    ".py",
    ".rs",
    ".ts",
    ".tsx",
}
EXCLUDED_DIRS = {
    ".angular",
    ".cache",
    ".git",
    ".github",
    ".npm-cache",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "reports",
    "tmp",
}


@dataclass(frozen=True)
class RuleFinding:
    rule_id: str
    severity: str
    message: str
    evidence: str


@dataclass(frozen=True)
class FileFinding:
    path: str
    status: str
    insecure_probability: float
    max_chunk: int
    rules: list[RuleFinding]


CRITICAL_RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "TS-RAW-PRISMA",
        re.compile(r"\$queryRawUnsafe|\$executeRawUnsafe", re.IGNORECASE),
        "Raw Prisma execution detected. Use parameterized Prisma APIs or tagged templates.",
    ),
    (
        "TS-EVAL",
        re.compile(r"\b(eval|Function)\s*\(", re.IGNORECASE),
        "Dynamic code execution detected.",
    ),
    (
        "TS-SHELL",
        re.compile(
            r"\b(child_process\.)?(exec|execSync)\s*\(|shell\s*:\s*true",
            re.IGNORECASE,
        ),
        "Shell execution pattern detected.",
    ),
    (
        "TS-XSS",
        re.compile(
            r"\.innerHTML\s*=|bypassSecurityTrust(Html|Script|Style|Url|ResourceUrl)",
            re.IGNORECASE,
        ),
        "Potential unsafe DOM sink detected.",
    ),
]

WARNING_RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "AUTH-LOCAL-STORAGE",
        re.compile(r"localStorage\.setItem\(\s*['\"](accessToken|refreshToken)", re.IGNORECASE),
        "Token storage in localStorage increases XSS impact.",
    ),
    (
        "SECRET-PLACEHOLDER",
        re.compile(r"change-me-[a-z0-9_-]+", re.IGNORECASE),
        "Placeholder secret present. It must not be used in production.",
    ),
    (
        "SECRET-LITERAL",
        re.compile(
            r"(?i)(password|secret|token|api[_-]?key)\s*[:=]\s*['\"](?!change-me|local-docker|test|demo)[^'\"]{8,}"
        ),
        "Potential hardcoded secret literal.",
    ),
]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Dockerized CodeBERT SAST gate for the Master Gateway project."
    )
    parser.add_argument("--path", action="append", default=[], help="File or directory to scan.")
    parser.add_argument("--changed-files", help="Text file with one changed path per line.")
    parser.add_argument(
        "--report",
        default="reports/codebert-sast.json",
        help="JSON report output path.",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("CODEBERT_MODEL", DEFAULT_MODEL),
        help="Hugging Face model id or local model directory.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help="Insecure probability threshold that fails the gate.",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=int(os.getenv("CODEBERT_MAX_CHARS", "6000")),
        help="Maximum characters per chunk before tokenization.",
    )
    parser.add_argument(
        "--warn-only",
        action="store_true",
        default=os.getenv("CODEBERT_WARN_ONLY", "").lower() in {"1", "true", "yes"},
        help="Always exit 0 after writing the report.",
    )
    args = parser.parse_args()

    workspace = Path.cwd()
    files = collect_files(workspace, args.path, args.changed_files)
    report_path = workspace / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)

    if not files:
        report = {
            "status": "SAFE",
            "details": "No source files matched the scan inputs.",
            "model": args.model,
            "threshold": args.threshold,
            "files": [],
        }
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 0

    tokenizer, model, model_type = load_model(args.model)
    model.eval()

    findings: list[FileFinding] = []
    for path in files:
        finding = analyze_file(path, workspace, tokenizer, model, model_type, args.threshold, args.max_chars)
        findings.append(finding)

    vulnerable = [finding for finding in findings if finding.status == "VULNERABLE"]
    status = "VULNERABLE" if vulnerable else "SAFE"
    report = {
        "status": status,
        "details": f"{len(vulnerable)} vulnerable file(s) found out of {len(findings)} analyzed.",
        "model": args.model,
        "threshold": args.threshold,
        "warn_only": args.warn_only,
        "files": [
            {
                **asdict(finding),
                "rules": [asdict(rule) for rule in finding.rules],
            }
            for finding in findings
        ],
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))

    if args.warn_only:
        return 0
    return 1 if status == "VULNERABLE" else 0


def collect_files(workspace: Path, paths: list[str], changed_files: str | None) -> list[Path]:
    candidates: list[Path] = []

    if changed_files:
        changed_path = resolve_input_path(workspace, changed_files)
        if changed_path.exists():
            for line in changed_path.read_text(encoding="utf-8-sig").splitlines():
                value = line.strip()
                if value:
                    candidates.append(resolve_input_path(workspace, value))

    for value in paths:
        target = resolve_input_path(workspace, value)
        if target.is_file():
            candidates.append(target)
        elif target.is_dir():
            candidates.extend(walk_sources(target))

    if not changed_files and not paths:
        candidates.extend(walk_sources(workspace / "backend" / "src"))
        candidates.extend(walk_sources(workspace / "frontend" / "src"))
        candidates.extend(walk_sources(workspace / "services"))

    unique: dict[str, Path] = {}
    for path in candidates:
        if is_source_file(path):
            unique[str(path.resolve())] = path
    return sorted(unique.values(), key=lambda item: item.as_posix())


def walk_sources(root: Path) -> Iterable[Path]:
    if not root.exists():
        return []
    return (
        path
        for path in root.rglob("*")
        if path.is_file() and is_source_file(path) and not is_excluded(path)
    )


def resolve_input_path(workspace: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else workspace / path


def is_source_file(path: Path) -> bool:
    return path.suffix.lower() in SOURCE_EXTENSIONS and not is_excluded(path)


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS for part in path.parts)


def load_model(model_name: str):
    config = AutoConfig.from_pretrained(model_name, trust_remote_code=True)
    arch = str(getattr(config, "architectures", []))
    is_multitask = "MultiTask" in arch or "multitask" in arch.lower()

    if is_multitask:
        tokenizer = AutoTokenizer.from_pretrained("microsoft/codebert-base", trust_remote_code=True)
        model = AutoModel.from_pretrained(model_name, trust_remote_code=True)
        return tokenizer, model, "multitask"

    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, trust_remote_code=True)
    return tokenizer, model, "standard"


def analyze_file(
    path: Path,
    workspace: Path,
    tokenizer,
    model,
    model_type: str,
    threshold: float,
    max_chars: int,
) -> FileFinding:
    code = path.read_text(encoding="utf-8", errors="replace")
    chunks = split_code(code, max_chars)
    probabilities = [predict_insecure_probability(chunk, tokenizer, model, model_type) for chunk in chunks]
    max_probability = max(probabilities) if probabilities else 0.0
    max_chunk = int(np.argmax(probabilities)) if probabilities else 0
    rules = scan_rules(code)
    has_critical_rule = any(rule.severity == "CRITICAL" for rule in rules)
    status = "VULNERABLE" if has_critical_rule or max_probability >= threshold else "SAFE"

    try:
        rel_path = path.relative_to(workspace)
    except ValueError:
        rel_path = path

    return FileFinding(
        path=rel_path.as_posix(),
        status=status,
        insecure_probability=round(float(max_probability), 4),
        max_chunk=max_chunk,
        rules=rules,
    )


def split_code(code: str, max_chars: int) -> list[str]:
    if len(code) <= max_chars:
        return [code]

    lines = code.splitlines()
    chunks: list[str] = []
    current: list[str] = []
    current_length = 0

    for line in lines:
        line_length = len(line) + 1
        if current and current_length + line_length > max_chars:
            chunks.append("\n".join(current))
            current = []
            current_length = 0
        current.append(line)
        current_length += line_length

    if current:
        chunks.append("\n".join(current))
    return chunks or [code[:max_chars]]


def predict_insecure_probability(code: str, tokenizer, model, model_type: str) -> float:
    encoded = tokenizer(
        code,
        return_tensors="pt",
        truncation=True,
        padding="max_length",
        max_length=512,
    )
    with torch.no_grad():
        outputs = model(**encoded)

    if model_type == "multitask":
        logits = outputs["vul_logits"].detach().cpu().numpy()[0]
    else:
        logits = outputs.logits.detach().cpu().numpy()[0]

    if logits.shape[0] == 1:
        return float(1.0 / (1.0 + np.exp(-logits[0])))

    probabilities = softmax(logits)
    insecure_index = insecure_label_index(model.config.id2label if model_type == "standard" else {"0": "LABEL_0", "1": "LABEL_1"})
    return float(probabilities[insecure_index])


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    return exp / exp.sum()


def insecure_label_index(id2label: dict[int, str] | dict[str, str]) -> int:
    normalized = {int(index): label.lower() for index, label in id2label.items()}
    for index, label in normalized.items():
        if any(token in label for token in ("insecure", "vulnerable", "unsafe", "label_1")):
            return index
    return 1 if len(normalized) > 1 else 0


def scan_rules(code: str) -> list[RuleFinding]:
    findings: list[RuleFinding] = []
    for rule_id, pattern, message in CRITICAL_RULES:
        match = pattern.search(code)
        if match:
            findings.append(
                RuleFinding(rule_id, "CRITICAL", message, evidence_for(code, match.start()))
            )
    for rule_id, pattern, message in WARNING_RULES:
        match = pattern.search(code)
        if match:
            findings.append(
                RuleFinding(rule_id, "WARNING", message, evidence_for(code, match.start()))
            )
    return findings


def evidence_for(code: str, offset: int) -> str:
    line_start = code.rfind("\n", 0, offset) + 1
    line_end = code.find("\n", offset)
    if line_end == -1:
        line_end = len(code)
    return code[line_start:line_end].strip()[:240]


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as error:
        print(f"codebert-sast error: {error}", file=sys.stderr)
        raise SystemExit(2)
