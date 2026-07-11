from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import numpy as np

model_id = "mrm8488/codebert-base-finetuned-detect-insecure-code"
tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForSequenceClassification.from_pretrained(model_id)
print(model.config.id2label)

samples = {
    "safe_ts": "export function add(a: number, b: number) { return a + b; }",
    "unsafe_eval": "const input = req.query.code; eval(input);",
    "unsafe_prisma": "await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = ${email}`);",
}

for name, code in samples.items():
    enc = tok(code, return_tensors="pt", truncation=True, padding="max_length", max_length=512)
    with torch.no_grad():
        logits = model(**enc).logits.detach().numpy()[0]
    exp = np.exp(logits - logits.max())
    probs = exp / exp.sum()
    print(name, "logits", logits.tolist(), "probs", probs.tolist())
