# Structured QR Sample Corpus

This folder contains the regression corpus used for parser hardening.

## Folder layout

```text
qr-samples/samples/
  <supplier>/
    valid/
    partial/
    malformed/
    edge-cases/
```

## Rules

- Keep one QR string per file.
- Use comments only for operator context.
- Keep samples realistic to the supplier's real tag format.
- Do not invent fantasy business rules in sample files.

## Suppliers

- `yug`
- `adinath`
- `utsav`
- `venzora`
- `zar`
