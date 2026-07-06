import { parseQR, normalizeParsedQR } from './src/services/qrParser.service.js'
import { calculateSettlementSnapshot } from './src/services/settlementCalculation.service.js'

function test() {
  const cases = [
    { supplier: 'Utsav', raw: 'LRG- 1.790', expected: { grossWeight: 1.79, netWeight: 1.79, stoneWeight: 0, otherWeight: 0, warningsHas: 'Fallback parser used' } },
    { supplier: 'Utsav', raw: 'GWT- 1.790 / NWT- 1.790', expected: { grossWeight: 1.79, netWeight: 1.79, stoneWeight: 0, otherWeight: 0 } },
    { supplier: 'Yug', raw: '1.790 SS 0.1 MS 0.2', expected: { grossWeight: 1.79, netWeight: 1.49, stoneWeight: 0.3 } },
    { supplier: 'Yug', raw: '1.790 OW 0.1 OT 0.2', expected: { grossWeight: 1.79, netWeight: 1.49, stoneWeight: 0, otherWeight: 0.3 } },
    { supplier: 'Utsav', raw: '1.790 / 1.800', expected: { grossWeight: 1.8, netWeight: 1.79, warningsHas: 'Net Weight Mismatch' } }, // wait, if net > gross, it's invalid
    { supplier: 'Aayra', raw: 'AAY-123 / 1.790 / 0.1 / 1.690', expected: { grossWeight: 1.79, stoneWeight: 0.1, netWeight: 1.69 } },
  ];

  let passed = 0;
  cases.forEach((c, i) => {
    const rawParsed = parseQR(c.raw, { name: c.supplier });
    const norm = normalizeParsedQR(rawParsed, { name: c.supplier });
    
    // Simulate locked 14K calculation
    const calc = calculateSettlementSnapshot({
      grossWeight: norm.grossWeight,
      stoneWeight: norm.stoneWeight,
      otherWeight: norm.otherWeight,
      qrNetWeight: norm.netWeight,
      purityPercent: 60, // 14K
      wastagePercent: 0,
      tolerance: 0.02
    });

    console.log(`Test ${i + 1}: ${c.supplier} | ${c.raw}`);
    console.log(`  Parsed: gross=${norm.grossWeight} net=${norm.netWeight} stone=${norm.stoneWeight} other=${norm.otherWeight}`);
    console.log(`  Calc: net=${calc.computedNetWeight} fine=${calc.fineWeight} warnings=${JSON.stringify(calc.warnings)}`);
    console.log('---');
  });
}
test();
