const CYR = { а:'a',б:'b',в:'v',г:'g',ғ:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',қ:'q',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ў:'o',ф:'f',х:'x',ҳ:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya' };

/** Klinika nomidan havola: lotin, kichik harf, defis. */
export function slugifyClinic(name = '') {
  return String(name)
    .toLowerCase()
    .split('').map((ch) => (CYR[ch] !== undefined ? CYR[ch] : ch)).join('')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[ʻʼ'`‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
