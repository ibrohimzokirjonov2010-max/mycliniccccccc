import {
  normalizePatientGender,
  patientGenderForDb,
  patientGenderLabel,
} from '../src/lib/patientGender.js';

const cases = [
  ['Female', 'female', 'Ayol'],
  ['female', 'female', 'Ayol'],
  ['Ayol', 'female', 'Ayol'],
  ['Male', 'male', 'Erkak'],
  ['male', 'male', 'Erkak'],
  ['Erkak', 'male', 'Erkak'],
  ['Unspecified', 'other', 'Boshqa'],
  ['', '', ''],
  [null, '', ''],
];

for (const [input, norm, label] of cases) {
  const got = normalizePatientGender(input);
  if (got !== norm) {
    throw new Error(`normalize(${JSON.stringify(input)}) = ${got}, expected ${norm}`);
  }
  const shown = patientGenderLabel(input, 'uz');
  if (shown !== label) {
    throw new Error(`label(${JSON.stringify(input)}) = ${shown}, expected ${label}`);
  }
}

if (patientGenderForDb('Female') !== 'female') throw new Error('db female');
if (patientGenderForDb('Unspecified') !== 'other') throw new Error('db other');
if (patientGenderForDb('') !== null) throw new Error('db empty should be null');
if (patientGenderLabel('female', 'uz') === 'Erkak') {
  throw new Error('female must not display as Erkak');
}

console.log('patient gender assertions passed');
