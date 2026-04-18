# QR Samples

Real QR strings collected from suppliers. Used to validate and tune the parser.

## How to add a sample

Create a `.txt` file named after the supplier:
```
qr-samples/
├── supplier-ashok.txt
├── supplier-mehta.txt
└── README.md
```

Each file should contain one QR string per line.
Add a comment above each one if you know what it means:

```
# Ring, gross 24.5g, stone 2.1g, net 22.4g
AA01|RING|24.5|2.1|22.4

# Necklace, unknown weights
AA01|NECK|0|0|0
```

## What to note per supplier

- What delimiter they use (|, ,, -, space, etc.)
- How many fields are in the QR
- What order the fields appear in
- Whether weights are integers or decimals
- Whether supplier code appears in the QR or not

## Status

| Supplier | Tag prefix | Sample file | QR string | Parser config ready |
|----------|------------|-------------|-----------|---------------------|
| Aadinath | BG-xxxx, LR-xx | supplier-aadinath.txt | ✅ 2 samples | ✅ sumIndices [1,2] |
| YUG | SWNK-xxxx | supplier-yug.txt | ✅ 1 sample | ✅ sumIndices [4,14] |
| Utsav (orange) | NST-xxxx | supplier-utsav.txt | ✅ 1 sample | ✅ stripPrefix GWT-/NWT-/SWT- |
| ZAR (Dazzling) | JFC-xxxxx | supplier-zar.txt | ✅ 1 sample | ⚠️ no weights in QR — manual only |

**Parser features used:**
- `sumIndices` — sum multiple QR positions into one field (Aadinath: S+B, YUG: SS+MS)
- `stripPrefix` — strip label prefix before parsing number (Utsav: "GWT-15.100" → 15.100)
