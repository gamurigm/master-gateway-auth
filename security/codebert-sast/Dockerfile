FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/cache/huggingface \
    TRANSFORMERS_NO_ADVISORY_WARNINGS=true

WORKDIR /scanner

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY security/codebert-sast/requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 \
    && pip install -r requirements.txt

# Se copian todos los .py del scanner, no solo el entrypoint: codebert_sast.py
# importa cwe_catalog. Copiar archivo por archivo hacia que anadir un modulo
# nuevo rompiera la imagen en CI sin fallar en local.
COPY security/codebert-sast/*.py ./

ENTRYPOINT ["python", "/scanner/codebert_sast.py"]
