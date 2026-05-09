# QR Samples

Real QR strings collected from suppliers. Used to validate and tune the parser.

## Layout

The legacy flat samples are still kept at the root of this folder:

```text
qr-samples/
  supplier-aadinath.txt
  supplier-utsav.txt
  supplier-venzora.txt
  supplier-yug.txt
  supplier-zar.txt
```

A structured regression corpus now lives under `qr-samples/samples/`:

```text
qr-samples/samples/
  yug/
    valid/
    partial/
    malformed/
    edge-cases/
  adinath/
    valid/
    partial/
    malformed/
    edge-cases/
  utsav/
    valid/
    partial/
    malformed/
    edge-cases/
  venzora/
    valid/
    partial/
    malformed/
    edge-cases/
  zar/
    valid/
    partial/
    malformed/
    edge-cases/
```

## How to add a sample

1. Put the raw QR string in a `.txt` file.
2. Keep one sample per file.
3. Use comments for context if needed.
4. Choose the right category:
   - `valid` for known-good real samples
   - `partial` for incomplete but realistic samples
   - `malformed` for broken or noisy QR strings
   - `edge-cases` for odd but still plausible variants

## What to note per supplier

- What delimiter they use
- How many fields are in the QR
- What order the fields appear in
- Whether weights are integers or decimals
- Whether supplier code appears in the QR or not

## Status

| Supplier | Tag prefix | Sample file | Parser config ready |
|----------|------------|-------------|---------------------|
| Aadinath | BG-xxxx, LR-xx | supplier-aadinath.txt | sumIndices [1,2] |
| YUG | SWNK-xxxx | supplier-yug.txt | sumIndices [4,14] |
| Utsav (orange) | NST-xxxx | supplier-utsav.txt | stripPrefix GWT-/NWT-/SWT- |
| Venzora | CH-xxxx | supplier-venzora.txt | tokenized parser |
| ZAR (Dazzling) | JFC-xxxxx | supplier-zar.txt | manual review only |

## Parser features used

- `sumIndices` - sum multiple QR positions into one field
- `stripPrefix` - strip label prefix before parsing a number
- `venzora` token parsing - detect prefixed tokens like `G16.970`
