import {
  applyToothSizes,
  firstToothSizeIssue,
  formatToothSizeSummary,
  toothSizeIssue,
} from '../src/components/implants/implantSize.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(toothSizeIssue({ diameter: '', length: '' }, { strict: false }) === '', 'empty is quiet while typing');
assert(toothSizeIssue({ diameter: '', length: '' }, { strict: true }) === 'missing', 'both required on advance');
assert(toothSizeIssue({ diameter: '4', length: '' }, { strict: true }) === 'need-length', 'length required with diameter');
assert(toothSizeIssue({ diameter: '', length: '10' }, { strict: true }) === 'need-diameter', 'diameter required with length');
assert(toothSizeIssue({ diameter: '4.0', length: '10' }, { strict: true }) === '', '4.0 x 10 accepted');
assert(toothSizeIssue({ diameter: '4,5', length: '11,5' }, { strict: true }) === '', 'comma decimals accepted');
assert(toothSizeIssue({ diameter: '4.', length: '10' }, { strict: true }) === 'bad-diameter', 'trailing dot is not a size');
assert(toothSizeIssue({ diameter: '4.', length: '10' }, { strict: false }) === '', 'trailing dot is quiet while typing');
assert(toothSizeIssue({ diameter: '0', length: '10' }, { strict: true }) === 'bad-diameter', 'zero rejected');
assert(toothSizeIssue({ diameter: '9', length: '10' }, { strict: true }) === 'bad-diameter', 'diameter above 8 rejected');
assert(toothSizeIssue({ diameter: '4', length: '2' }, { strict: true }) === 'bad-length', 'short length rejected');
assert(toothSizeIssue({ diameter: 'abc', length: '10' }, { strict: false }) === 'bad-diameter', 'letters rejected immediately');
assert(formatToothSizeSummary({ diameter: '4', length: '10' }) === 'Ø4.0×10', 'chip summary');
assert(formatToothSizeSummary({ diameter: '4.5', length: '11.5' }) === 'Ø4.5×11.5', 'decimal chip');
assert(formatToothSizeSummary({ diameter: '4', length: '' }) === '', 'incomplete chip stays hidden');

const normalized = applyToothSizes({ diameter: '4,0', length: '10', firma: 'Osstem', notes: 'ok' });
assert(normalized.diameter === 4 && normalized.length === 10, 'saved as numbers');
assert(normalized.firma === 'Osstem' && normalized.notes === 'ok', 'other tooth fields kept');
assert(applyToothSizes({ diameter: '', length: '' }).diameter === undefined, 'empty size omitted');

const problem = firstToothSizeIssue(['16', '26'], {
  16: { diameter: '4.0', length: '10' },
  26: { diameter: '', length: '' },
}, { strict: true });
assert(problem?.fdi === '26' && problem.issue === 'missing', 'first incomplete tooth is reported');

console.log('assert-implant-size: ok');
