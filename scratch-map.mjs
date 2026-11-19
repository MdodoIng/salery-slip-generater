// Scratch: replicate importSheet.ts header mapping against the REAL new template headers.
const ALIASES_OLD = {
  empId: ['empid', 'employeeid', 'empcode', 'employeecode', 'code', 'id', 'empno', 'employeeno'],
  name: ['name', 'employeename', 'employee', 'fullname'],
  designation: ['designation', 'post', 'role', 'title'],
  department: ['department', 'dept', 'section'],
  salary: ['salary', 'basicsalary', 'monthlysalary', 'wages'],
  ot: ['ot', 'overtime', 'otamount', 'overtimeamount', 'otrs'],
  pendingLeave: ['pendingleave', 'leave', 'leaves', 'leavebalance', 'lop', 'absent', 'absentdays'],
  bankAdvance: ['bankadvance', 'bank', 'advance', 'bankdeduction'],
  cashAdvance: ['cashadvance', 'cash', 'cashdeduction', 'advancecash']
}
const IGNORED = ['gross', 'total', 'net', 'payable', 'remarks', 'note']
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function oldMap(header) {
  const h = norm(header)
  if (!h || IGNORED.some((x) => h.includes(x))) return 'IGNORED'
  for (const [f, a] of Object.entries(ALIASES_OLD)) if (a.includes(h)) return f
  for (const [f, a] of Object.entries(ALIASES_OLD)) if (a.some((x) => h.includes(x) && x.length > 3)) return f
  return null
}

const HEADERS = ['SL NO', 'EMP ID', 'PUNCHING NO', 'NAME', 'DESIGNATION', 'DEPARTMENT', 'SALARY',
  'TOTAL WORKING DAYS', 'SALARY', 'OT', 'COMMISSION', 'SUNDAY', 'GROSS SALARY', 'BANK ADVANCE',
  'CASH ADVANCE', 'ESI DEDUCTION', 'PF DEDUCTION', 'BASIC SALARY', 'OTHER ALLOWANCE', 'HRA',
  'PENDING LEAVE', 'BALANCE AMOUNT']

console.log('=== CURRENT importer behaviour on the NEW template ===')
const seen = new Set()
for (const hd of HEADERS) {
  let f = oldMap(hd)
  let note = ''
  if (f && f !== 'IGNORED') {
    if (seen.has(f)) { f = f + ' (dup)'; note = '  <-- DROPPED by dedup' } else seen.add(f)
  } else if (f === null) note = '  <-- SILENTLY LOST'
  else if (f === 'IGNORED') note = '  (ignored as computed)'
  console.log(String.raw`${hd.padEnd(20)} -> ${String(f).padEnd(22)}${note}`)
}

console.log('\n=== break-up arithmetic check from the dump ===')
console.log('row1 salary 22000 : otherAllowance 6600 =', (22000 * 0.3).toFixed(0), '| hra 4400 =', (22000 * 0.2).toFixed(0), '| implied basic =', 22000 - 6600 - 4400)
console.log('row2 salary 32000 : otherAllowance 9600 =', (32000 * 0.3).toFixed(0), '| hra 6400 =', (32000 * 0.2).toFixed(0), '| implied basic =', 32000 - 9600 - 6400)
console.log('=> HRA + OTHER ALLOWANCE + BASIC = SALARY exactly; they are a BREAK-UP of SALARY, not extra pay.')
