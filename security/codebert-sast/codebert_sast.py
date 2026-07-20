from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np

from cwe_catalog import OWASP_VERSION, enrich

# torch y transformers se importan de forma perezosa dentro de load_model /
# predict_insecure_probability: pesan ~2 GB y el motor de reglas (que es lo que
# ejercita selftest.py) no los necesita.


DEFAULT_MODEL = "mrm8488/codebert-base-finetuned-detect-insecure-code"
DEFAULT_THRESHOLD = float(os.getenv("CODEBERT_THRESHOLD", "0.85"))
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
# Ficheros de configuracion: no se pasan por el modelo (no es codigo fuente),
# solo por las reglas de CONFIG_RULES para cazar secretos versionados.
CONFIG_EXTENSIONS = {".yml", ".yaml", ".env", ".ini", ".cfg", ".properties", ".tf"}
EXCLUDED_DIRS = {
    ".angular",
    ".cache",
    ".git",
    ".github",
    ".npm-cache",
    "__pycache__",
    "coverage",
    "dist",
    "fixtures",
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
    line: int


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
    (
        "TS-PATH-TRAVERSAL",
        re.compile(
            r"(path\.(join|resolve)|readFile(Sync)?|createReadStream|sendFile)\s*\([^)]*\b"
            r"(req|request)\.(params|query|body)\b",
            re.IGNORECASE,
        ),
        "Filesystem path built from request input without normalization.",
    ),
    (
        "TS-SSRF",
        re.compile(
            r"\b(axios\.(get|post|put|delete|request)|fetch|got|http\.request|https\.request)"
            r"\s*\([^)]*\b(req|request)\.(params|query|body)\b",
            re.IGNORECASE,
        ),
        "Outbound request to a URL derived from user input (SSRF).",
    ),
    (
        "TS-WEAK-CRYPTO",
        re.compile(
            r"createHash\s*\(\s*['\"](md5|sha1)['\"]|createCipheriv?\s*\(\s*['\"](des|rc4|aes-\d+-ecb)",
            re.IGNORECASE,
        ),
        "Broken or risky cryptographic algorithm in use.",
    ),
    (
        "TS-DESERIALIZATION",
        re.compile(
            r"node-serialize|unserialize\s*\(|Object\.assign\s*\([^)]*\b(req|request)\.body\b",
            re.IGNORECASE,
        ),
        "Untrusted data materialized without schema validation.",
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
    (
        "TS-INSECURE-RANDOM",
        re.compile(
            r"(?i)(token|secret|otp|nonce|salt|session|apikey|api_key)[^\n]{0,60}Math\.random\s*\(",
        ),
        "Security-sensitive value derived from a non-cryptographic PRNG.",
    ),
    (
        "TS-MISSING-AUTHZ",
        re.compile(r"@Controller\s*\((?![^)]*internal)"),
        "Controller exposed without @UseGuards/@RequireRoles in the same file.",
    ),
    (
        # Un `catch {}` seguido de `finally {` no es un swallow silencioso:
        # el bloque finally sigue ejecutando la compensacion (ej. limpiar sesion).
        "TS-SWALLOWED-ERROR",
        re.compile(r"catch\s*(\([^)]*\))?\s*\{\s*\}(?!\s*finally\s*\{)", re.MULTILINE),
        "Empty catch block hides failures, including security-relevant ones.",
    ),
]

# Reglas aplicadas solo a ficheros de configuracion (.yml, .env, ...).
CONFIG_RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "SECRET-IN-CONFIG",
        re.compile(
            r"(?im)^\s*-?\s*[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|API_?KEY)[A-Z0-9_]*\s*[:=]\s*"
            r"(?!['\"]?\$\{)(?!['\"]?change-me)(?!['\"]?\s*$)['\"]?[A-Za-z0-9!@#$%^&*_+-]{12,}"
        ),
        "Hardcoded credential in a versioned configuration file. Use ${VAR} indirection.",
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
        "--markdown-report",
        default="reports/codebert-sast.md",
        help="Human-readable Markdown report output path.",
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
    parser.add_argument(
        "--include-fixtures",
        action="store_true",
        help="Allow scanning security/fixtures (used by selftest.py only).",
    )
    parser.add_argument(
        "--rules-only",
        action="store_true",
        default=os.getenv("CODEBERT_RULES_ONLY", "").lower() in {"1", "true", "yes"},
        help="Skip the ML model and run only the CWE rule engine (no weights download).",
    )
    args = parser.parse_args()

    if args.include_fixtures:
        EXCLUDED_DIRS.discard("fixtures")

    started = time.perf_counter()
    workspace = Path.cwd()
    files = collect_files(workspace, args.path, args.changed_files)
    report_path = workspace / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)

    if not files:
        report = build_report("SAFE", [], args, 0.0, "No source files matched the scan inputs.")
        write_reports(report, report_path, workspace / args.markdown_report)
        return 0

    source_files = [path for path in files if is_source_file(path)]
    config_files = [path for path in files if is_config_file(path)]

    findings: list[FileFinding] = []

    if source_files and args.rules_only:
        for path in source_files:
            findings.append(analyze_file_rules_only(path, workspace))
    elif source_files:
        tokenizer, model, model_type = load_model(args.model)
        model.eval()
        for path in source_files:
            findings.append(
                analyze_file(
                    path, workspace, tokenizer, model, model_type, args.threshold, args.max_chars
                )
            )

    for path in config_files:
        findings.append(analyze_config_file(path, workspace))

    vulnerable = [finding for finding in findings if finding.status == "VULNERABLE"]
    status = "VULNERABLE" if vulnerable else "SAFE"
    duration = time.perf_counter() - started
    details = f"{len(vulnerable)} vulnerable file(s) found out of {len(findings)} analyzed."

    report = build_report(status, findings, args, duration, details)
    write_reports(report, report_path, workspace / args.markdown_report)

    if args.warn_only:
        return 0
    return 1 if status == "VULNERABLE" else 0


def build_report(
    status: str,
    findings: list[FileFinding],
    args: argparse.Namespace,
    duration: float,
    details: str,
) -> dict:
    """Arma el JSON del reporte, enriqueciendo cada hallazgo con su CWE y OWASP 2025."""
    by_severity: Counter[str] = Counter()
    by_cwe: Counter[str] = Counter()
    by_owasp: Counter[str] = Counter()

    serialized_files = []
    for finding in findings:
        rules = []
        for rule in finding.rules:
            metadata = enrich(rule.rule_id)
            by_severity[rule.severity] += 1
            by_cwe[metadata["cwe_id"]] += 1
            by_owasp[metadata["owasp_id"]] += 1
            rules.append({**asdict(rule), **metadata})
        serialized_files.append({**asdict(finding), "rules": rules})

    vulnerable_files = [item for item in findings if item.status == "VULNERABLE"]

    return {
        "status": status,
        "details": details,
        "model": args.model,
        "threshold": args.threshold,
        "warn_only": args.warn_only,
        "owasp_version": OWASP_VERSION,
        "summary": {
            "total_files": len(findings),
            "vulnerable_files": len(vulnerable_files),
            "total_findings": sum(by_severity.values()),
            "by_severity": dict(by_severity),
            "by_cwe": dict(by_cwe),
            "by_owasp_2025": dict(sorted(by_owasp.items())),
            "scan_duration_s": round(duration, 2),
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "files": serialized_files,
    }


def write_reports(report: dict, json_path: Path, markdown_path: Path) -> None:
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(render_markdown_report(report), encoding="utf-8")
    print(json.dumps(report, indent=2))


def render_markdown_report(report: dict) -> str:
    """Reporte legible: resumen ejecutivo, cobertura OWASP 2025 y detalle por archivo."""
    summary = report.get("summary", {})
    icon = "❌" if report["status"] == "VULNERABLE" else "✅"

    lines = [
        "# Informe SAST - Master Gateway",
        "",
        f"**Estado:** {icon} `{report['status']}`  ",
        f"**Modelo:** `{report['model']}`  ",
        f"**Umbral ML:** `{report['threshold']}`  ",
        f"**Taxonomia:** CWE + OWASP Top 10 : {report.get('owasp_version', '2025')}  ",
        f"**Generado:** {summary.get('generated_at', 'n/d')} "
        f"({summary.get('scan_duration_s', 0)} s)",
        "",
        "## Resumen ejecutivo",
        "",
        "| Metrica | Valor |",
        "| --- | --- |",
        f"| Archivos analizados | {summary.get('total_files', 0)} |",
        f"| Archivos vulnerables | {summary.get('vulnerable_files', 0)} |",
        f"| Hallazgos totales | {summary.get('total_findings', 0)} |",
        f"| Criticos | {summary.get('by_severity', {}).get('CRITICAL', 0)} |",
        f"| Advertencias | {summary.get('by_severity', {}).get('WARNING', 0)} |",
        "",
    ]

    by_cwe = summary.get("by_cwe", {})
    if by_cwe:
        lines += ["## Hallazgos por CWE", "", "| CWE | Ocurrencias |", "| --- | --- |"]
        lines += [f"| {cwe} | {count} |" for cwe, count in sorted(by_cwe.items())]
        lines.append("")

    by_owasp = summary.get("by_owasp_2025", {})
    if by_owasp:
        from cwe_catalog import OWASP_2025

        lines += [
            f"## Cobertura OWASP Top 10 : {report.get('owasp_version', '2025')}",
            "",
            "| Categoria | Hallazgos |",
            "| --- | --- |",
        ]
        lines += [
            f"| {OWASP_2025.get(key, key)} | {count} |" for key, count in sorted(by_owasp.items())
        ]
        lines.append("")

    vulnerable = [item for item in report["files"] if item["status"] == "VULNERABLE"]
    if not vulnerable:
        lines += ["## Detalle", "", "Sin hallazgos que bloqueen el pipeline.", ""]
        return "\n".join(lines)

    lines += ["## Detalle por archivo", ""]
    for item in vulnerable:
        lines.append(f"### `{item['path']}`")
        lines.append("")
        lines.append(f"Probabilidad ML de codigo inseguro: **{item['insecure_probability']}**")
        lines.append("")
        if not item["rules"]:
            lines += ["Detectado unicamente por el modelo de mineria de datos.", ""]
            continue
        for rule in item["rules"]:
            cves = ", ".join(rule.get("reference_cves") or []) or "-"
            lines += [
                f"- **[{rule['severity']}] {rule['cwe_id']}** - {rule['cwe_name']}",
                f"  - Regla: `{rule['rule_id']}`",
                f"  - OWASP: {rule['owasp_2025']}",
                f"  - Ubicacion: `{item['path']}:{rule['line']}`",
                f"  - Evidencia: `{rule['evidence']}`",
                f"  - CVEs de referencia: {cves}",
                f"  - Remediacion: {rule['remediation']}",
                "",
            ]
    return "\n".join(lines)


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
        candidates.extend(walk_sources(workspace / "frontend-vue" / "src"))
        candidates.extend(walk_sources(workspace / "services"))
        candidates.append(workspace / "docker-compose.yml")

    unique: dict[str, Path] = {}
    for path in candidates:
        if path.exists() and (is_source_file(path) or is_config_file(path)):
            unique[str(path.resolve())] = path
    return sorted(unique.values(), key=lambda item: item.as_posix())


def walk_sources(root: Path) -> Iterable[Path]:
    if not root.exists():
        return []
    return (
        path
        for path in root.rglob("*")
        if path.is_file()
        and (is_source_file(path) or is_config_file(path))
        and not is_excluded(path)
    )


def resolve_input_path(workspace: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else workspace / path


def is_source_file(path: Path) -> bool:
    return path.suffix.lower() in SOURCE_EXTENSIONS and not is_excluded(path)


def is_config_file(path: Path) -> bool:
    suffix = path.suffix.lower()
    is_config = suffix in CONFIG_EXTENSIONS or path.name.startswith(".env")
    return is_config and not is_excluded(path)


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS for part in path.parts)


def load_model(model_name: str):
    from transformers import (
        AutoConfig,
        AutoModel,
        AutoModelForSequenceClassification,
        AutoTokenizer,
    )

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
    probabilities = [
        predict_insecure_probability(chunk, tokenizer, model, model_type) for chunk in chunks
    ]
    max_probability = max(probabilities) if probabilities else 0.0
    max_chunk = int(np.argmax(probabilities)) if probabilities else 0
    rules = scan_rules(code, path)
    has_critical_rule = any(rule.severity == "CRITICAL" for rule in rules)
    ml_flagged = max_probability >= threshold

    if ml_flagged:
        rules = rules + [
            RuleFinding(
                "ML-ANOMALY",
                "CRITICAL",
                f"Model flagged this file with insecure probability {max_probability:.4f} "
                f"(threshold {threshold}).",
                f"chunk #{max_chunk}",
                1,
            )
        ]

    status = "VULNERABLE" if has_critical_rule or ml_flagged else "SAFE"

    return FileFinding(
        path=relative_path(path, workspace),
        status=status,
        insecure_probability=round(float(max_probability), 4),
        max_chunk=max_chunk,
        rules=rules,
    )


def analyze_file_rules_only(path: Path, workspace: Path) -> FileFinding:
    """Analiza con el motor de reglas CWE, sin cargar el modelo (--rules-only)."""
    code = path.read_text(encoding="utf-8", errors="replace")
    rules = scan_rules(code, path)
    has_critical_rule = any(rule.severity == "CRITICAL" for rule in rules)
    return FileFinding(
        path=relative_path(path, workspace),
        status="VULNERABLE" if has_critical_rule else "SAFE",
        insecure_probability=0.0,
        max_chunk=0,
        rules=rules,
    )


def analyze_config_file(path: Path, workspace: Path) -> FileFinding:
    """Los ficheros de configuracion no pasan por el modelo, solo por CONFIG_RULES."""
    content = path.read_text(encoding="utf-8", errors="replace")
    rules = apply_rules(content, CONFIG_RULES, "CRITICAL")
    return FileFinding(
        path=relative_path(path, workspace),
        status="VULNERABLE" if rules else "SAFE",
        insecure_probability=0.0,
        max_chunk=0,
        rules=rules,
    )


def relative_path(path: Path, workspace: Path) -> str:
    try:
        return path.relative_to(workspace).as_posix()
    except ValueError:
        return path.as_posix()


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
    import torch

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
    insecure_index = insecure_label_index(
        model.config.id2label if model_type == "standard" else {"0": "LABEL_0", "1": "LABEL_1"}
    )
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


def scan_rules(code: str, path: Path | None = None) -> list[RuleFinding]:
    findings = apply_rules(code, CRITICAL_RULES, "CRITICAL")
    findings += apply_rules(code, WARNING_RULES, "WARNING", context=code, path=path)
    return findings


# Reglas que no aplican a ficheros de test: las credenciales de un spec son
# datos de prueba, no secretos de produccion.
TEST_EXEMPT_RULES = {"SECRET-LITERAL", "SECRET-PLACEHOLDER"}

# Tope de ocurrencias reportadas por regla y archivo, para que un patron repetido
# no ahogue el reporte ni el mensaje de Telegram.
MAX_MATCHES_PER_RULE = 5

# Reglas cuya evidencia contiene el propio secreto. El reporte viaja a artefactos
# de CI y a un grupo de Telegram, asi que el valor se enmascara: filtrarlo ahi
# ampliaria la exposicion en lugar de reducirla.
SECRET_RULES = {"SECRET-LITERAL", "SECRET-PLACEHOLDER", "SECRET-IN-CONFIG"}

SECRET_VALUE_PATTERN = re.compile(
    r"""(?ix)
    (?P<key>[A-Za-z0-9_.-]*(password|secret|token|api[_-]?key)[A-Za-z0-9_.-]*)
    (?P<sep>\s*[:=]\s*)
    (?P<quote>['"]?)
    # Se excluyen corchetes/parentesis para no confundir una expresion
    # (p. ej. `env['API_KEY'] ?? fallback`) con un valor literal.
    (?P<value>[^'"\s,;\[\]()]{4,})
    (?P=quote)
    """
)


def redact_secret(evidence: str) -> str:
    """Enmascara el valor manteniendo el nombre de la clave y una pista de longitud."""

    def mask(match: re.Match[str]) -> str:
        value = match.group("value")
        quote = match.group("quote")
        hint = f"<REDACTED:{len(value)} chars>"
        return f"{match.group('key')}{match.group('sep')}{quote}{hint}{quote}"

    return SECRET_VALUE_PATTERN.sub(mask, evidence)


def apply_rules(
    code: str,
    rules: list[tuple[str, re.Pattern[str], str]],
    severity: str,
    context: str | None = None,
    path: Path | None = None,
) -> list[RuleFinding]:
    findings: list[RuleFinding] = []
    for rule_id, pattern, message in rules:
        if rule_id == "TS-MISSING-AUTHZ" and not is_unguarded_controller(context or code, path):
            continue
        if rule_id in TEST_EXEMPT_RULES and is_test_file(path):
            continue

        # Se reportan todas las ocurrencias, no solo la primera: si solo se
        # mirase la primera, suprimirla ocultaria el resto del archivo.
        seen_lines: set[int] = set()
        for match in pattern.finditer(code):
            line, evidence = evidence_for(code, match.start())
            if line in seen_lines or is_suppressed(code, line, rule_id):
                continue
            seen_lines.add(line)
            if rule_id in SECRET_RULES:
                evidence = redact_secret(evidence)
            findings.append(RuleFinding(rule_id, severity, message, evidence, line))
            if len(seen_lines) >= MAX_MATCHES_PER_RULE:
                break
    return findings


def is_test_file(path: Path | None) -> bool:
    if path is None:
        return False
    return path.name.endswith((".spec.ts", ".spec.js", ".e2e-spec.ts", ".test.ts", ".test.js"))


def is_suppressed(code: str, line: int, rule_id: str) -> bool:
    """Permite silenciar un hallazgo justificado con `// sast-ignore: RULE-ID motivo`.

    El marcador vale en la propia linea del hallazgo o en cualquier linea del
    bloque de comentarios contiguo inmediatamente anterior, de modo que la
    justificacion pueda ocupar varias lineas. Sin este mecanismo, un unico falso
    positivo obliga a desactivar la regla entera para todo el repositorio.
    """
    lines = code.splitlines()
    marker = f"sast-ignore: {rule_id}"
    index = line - 1

    if 0 <= index < len(lines) and marker in lines[index]:
        return True

    # Recorre hacia arriba mientras sigan siendo comentarios o lineas en blanco.
    index -= 1
    while 0 <= index < len(lines):
        stripped = lines[index].strip()
        if not (stripped.startswith(("//", "#", "*", "/*")) or stripped == ""):
            return False
        if marker in stripped:
            return True
        index -= 1
    return False


COMMENT_PATTERN = re.compile(r"//[^\n]*|/\*.*?\*/", re.DOTALL)


def strip_comments(code: str) -> str:
    """Elimina comentarios preservando los saltos de linea (para no descuadrar los numeros de linea).

    Necesario porque un comentario del tipo "TODO: falta @UseGuards" haria creer
    a la heuristica de autorizacion que el controlador si esta protegido.
    """
    return COMMENT_PATTERN.sub(lambda match: "\n" * match.group().count("\n"), code)


def is_unguarded_controller(code: str, path: Path | None) -> bool:
    """Un @Controller solo es hallazgo si el archivo no aplica ningun guard ni rol."""
    if path is not None and path.name.endswith((".spec.ts", ".e2e-spec.ts")):
        return False
    return not re.search(r"@UseGuards\s*\(|@RequireRoles\s*\(|@Public\s*\(", strip_comments(code))


def evidence_for(code: str, offset: int) -> tuple[int, str]:
    """Devuelve (numero de linea 1-indexado, texto de la linea recortado)."""
    line_number = code.count("\n", 0, offset) + 1
    line_start = code.rfind("\n", 0, offset) + 1
    line_end = code.find("\n", offset)
    if line_end == -1:
        line_end = len(code)
    return line_number, code[line_start:line_end].strip()[:240]


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as error:
        print(f"codebert-sast error: {error}", file=sys.stderr)
        raise SystemExit(2)
