import { parseQR, normalizeParsedQR } from './src/services/qrParser.service.js'
import { calculateSettlementSnapshot } from './src/services/settlementCalculation.service.js'

function test() {
  const cases = [
    { supplier: 'Aayra', raw: 'N66182/G 1.944/L .261/N 1.683/LR-1793' },
    { supplier: 'Aayra', raw: 'N66227/G 1.32/L 0.04/N 1.28/LR-2500' },
    { supplier: 'Aayra', raw: '00002490 NMLR18 B0093 1.474 0.000 1.474' },
    { supplier: 'Aayra', raw: '00002402 NMLR18 B0005 2.549 0.000 2.549' },
    { supplier: 'Aayra', raw: '00002478 NMLR18 B0081 3.763 0.000 3.763' },
    { supplier: 'Aayra', raw: '00002465 NMLR18 B0068 2.010 0.000 2.010' },
    { supplier: 'Yug', raw: '2491159/230420/18K/6.66/0.648/5.598/549/SWMS - 2797/17/R+G/2J0Y0/0/0.278/WHITE/0.136/0/0/0/56/0/0.278' },
    { supplier: 'Yug', raw: '2496936/230684/18K/4.82/0.09/4.372/289/SWMS - 2859/17/Y+W/2J0Y0/0/0.208/WHITE/0.15/0/0/0/56/0/0.208' },
    { supplier: 'Yug', raw: 'SWMS-2819 , gw 4.970, SS 0.300 Rs 202 MS 0.050 OW 0.052 NW 4.568' },
    { supplier: 'Yug', raw: 'SWL-13406, GW 2.155 SS 0.000 Rs 144 MS 0.048 rs 0 ow 0.00 rs 0, NW 2.107' },
    { supplier: 'Utsav', raw: 'LRG-/GWT-1.790/HUID/75/////USV' },
    { supplier: 'Utsav', raw: 'LRG-/GWT-2.860/HUID/75/////USV' },
    { supplier: 'Utsav', raw: 'LRG-/GWT-2170/HUID/75/////USV' },
    { supplier: 'Utsav', raw: 'PST-2743/GWT-2.190/NWT-2.010/SWT-0.180//MIX3JH//75/USV' },
    { supplier: 'Utsav', raw: 'PST-4821/GWT-2.050/NWT-1.730/SWT-0.260/CL-0.060/M6RL2W//75/USV' },
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
    console.log(`  Parsed: code=${norm.itemCode} gross=${norm.grossWeight} net=${norm.netWeight} stone=${norm.stoneWeight} other=${norm.otherWeight}`);
    console.log(`  Calc: net=${calc.computedNetWeight} fine=${calc.fineWeight} warnings=${JSON.stringify(calc.warnings)}`);
    console.log('---');
  });
}
test();
