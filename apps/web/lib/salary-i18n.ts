import {
  formatTaka,
  hraAreaLabel,
  type AllowanceLine,
  type EmployeeGrossResult,
  type HraArea,
  type Salary2026Result,
  type Salary2026StepRow,
} from '@ibas/shared-types';
import { toBanglaDigits } from '@/lib/bangla-format';

export type SalaryLocale = 'en' | 'bn';

/** Rich text as [text, bold] segments. */
export type Segments = Array<[string, boolean]>;

const salaryEn = {
  title: 'Salary On 2026',
  brandSub: 'Salary calculator',
  shareBtn: 'Share',
  linkCopied: 'Link copied — share it with anyone.',
  heroKicker: 'National Pay Scale',
  heroTitle: 'Your Arrears Bill & Basic on Proposed National Pay scale-2026',
  heroBadge: 'Download Prepared Arrear Bill with your Net Arrear',
  publishedNote: 'Based on the National Pay Scale 2026 conversion stages shown below.',
  rules: [
    [
      ['1. Stage-1 (01-07-2026): ', true],
      ['Step 5 = (Step 4 − old pay) × ', false],
      ['40%', true],
      [' (grades 1–9) / ', false],
      ['50%', true],
      [' (grades 10–20); Step 6 = next stage − Step 4; Step 7 = old pay + Step 5 + Step 6.', false],
    ],
    [
      ['2. Stage-2 (01-01-2027): ', true],
      ['Same steps; Step 5 rate ', false],
      ['70%', true],
      [' (grades 1–9) / ', false],
      ['75%', true],
      [' (grades 10–20).', false],
    ],
    [
      ['3. Stage-3: ', true],
      ['01-07-2026 basic = next stage after matched Step 4; 01-07-2027 basic = next stage after that.', false],
    ],
  ] as Segments[],
  currentPay: 'Your current pay (NPS 2015)',
  grade: 'Grade',
  basicJune: 'Basic on 30 June 2026',
  fixedPay: 'Fixed pay',
  nps2015: 'NPS 2015:',
  nps2026: 'NPS 2026:',
  postType: 'Post type (Grades 2–10)',
  regular: 'Regular (default)',
  currentCharge: 'Current charge — extra ৳ 1,500 / month',
  substantive: 'Substantive grade (for tiffin, conveyance & arrears)',
  substantiveNA: 'Not applicable / not Grade 11–15',
  substantiveHint:
    'Grades 7–10: if substantive grade is 11–15, tiffin ৳ 200 and conveyance ৳ 300 apply, and the arrears special allowance is taken at 15%.',
  housing: 'Housing',
  hraEligible: 'Eligible for House Rent Allowance (select posting area)',
  govtAccommodation: 'Government-provided accommodation (HRA not payable; house-rent deduction may apply)',
  hraArea: 'Posting / HRA area',
  education: 'Education assistance (children)',
  educationOptions: ['None — ৳ 0', '1 child — ৳ 500 / month', '2 children (max) — ৳ 1,000 / month'],
  washing: 'Washing allowance (uniformed 4th Class)',
  no: 'No',
  washingYes: 'Yes — ৳ 100 / month',
  gpf: 'GPF deduction (optional)',
  gpfPlaceholder: 'Type GPF amount, e.g. 5000',
  gpfHint: (amount: string | null) =>
    `Applied on each of the 3 stages only (Basic + Total Allowance − GPF → Net payable)${amount ? ` (GPF ${amount})` : ''}.`,
  grossNote:
    'Medical ৳ 1,500 is included for all. Tiffin ৳ 200 and Conveyance ৳ 300 apply for Grades 11–15 (or substantive Grade 11–15 when pay grade is 7–10). Grades 2–10 may add Current charge ৳ 1,500. Festival (2× basic / year), Pahela Baishakh (20%), and Rest & Recreation (1× basic every 3 years) are shown separately after calculation.',
  calculate: 'Calculate Salary on 2026',
  calcError: 'Could not calculate',
  pdf: 'Give me a PDF',
  totalAllowance: 'Total Allowance (01 June to 31-12-2027)',
  grossSub: (grade: string, housing: string) => `Fixed on Basic 30 June 2026 · Grade ${grade} · Housing: ${housing}`,
  govtHousing: 'Government accommodation',
  component: 'Component',
  note: 'Note',
  amount: 'Amount (৳)',
  basicShown: 'Basic pay (30 June 2026) — shown, not summed',
  basicRef: 'Reference basic for allowances',
  annualHead: 'Annual / periodic benefit',
  stageTitle: (n: number, date: string) => `Stage-${n} · ${date}`,
  step5Rate: (pct: string) => `${pct}% Step 5`,
  stepCol: 'Step',
  descCol: 'Description',
  calcCol: 'Calculation',
  oldBasic: 'Old basic (30-06-26)',
  matched: 'Matched 2026 stage',
  newBasic: (date: string) => `New basic (${date})`,
  basic2026: '01-07-2026 basic',
  basic2027: '01-07-2027 basic',
  nextStage: (amount: string) => `+ ${amount} (next stage)`,
  lastStage: 'Last stage — no change',
  lastStageWarn: 'Matched stage is the last stage on the 2026 scale — Step 6 = 0 (no next stage).',
  basic: 'Basic',
  basicNote: 'This stage — not included in Total Allowance',
  fixedOnBasic: 'Fixed on Basic 30 June 2026',
  basicPlusAllowance: 'Basic + Total Allowance',
  gpfDeduction: 'GPF deduction',
  netPayable: 'Net payable',
  netFormula: 'Basic + Total Allowance − GPF',
  thanksKicker: 'With gratitude',
  thanksTitle: 'Thank you, Government of Bangladesh',
  thanksText: [
    ['From ', false],
    ['all government employees', true],
    [
      ' — we gratefully acknowledge the proposed National Pay Scale 2026 and the continued efforts to improve the livelihood and dignity of public servants across the country.',
      false,
    ],
  ] as Segments,
  thanksSign: '— All Government Employees',
  footerTagline: 'Rules, exams, and compliance assistant',
  footerNote: 'Salary On 2026 · Free public tool · Share the link with anyone',

  arrMonths: 'Months to include',
  arrPast: 'Past months',
  arrAll: 'All',
  arrClear: 'Clear',
  arrSelectMonth: 'Select at least one month.',
  arrBandHigh: 'grades 10–20',
  arrBandLow: 'grades 1–9',
  arrHraNone: 'Government accommodation — no house rent was paid',
  arrColMonth: 'Month',
  arrColNewBasic: 'Basic on Pay Fixation 2026',
  arrColDrawn: 'Basic Drawn on Pay Scale 2015',
  arrColDiff: 'Difference',
  arrColSpecial: 'Special allowance',
  arrColHra: 'Excess house rent',
  arrColHraProtection: 'House rent protection',
  arrColNet: 'Net arrears',
  arrTotalRow: (n: string, one: boolean) => `Total (${n} ${one ? 'month' : 'months'})`,
  arrMathTitle: 'Total arrears due',
  arrMathTotal: 'Total arrears',
  arrMathDeductions: 'Less: Total deductions',
  arrMathNet: 'Net arrears',
  inWords: (words: string) => `In words: ${words}`,
  arrNegative: 'A negative amount is to be recovered.',
  stageName: (n: number) => `Stage-${n}`,
  arrExtraTitle: 'Other deductions (tick only if this bill has the issue)',
  arrExtraHead: 'Other deductions',
  arrExcessRr: 'Excess Rest & Recreation deduction',
  arrExcessPuja: 'Excess Puja bonus deduction',
  arrExcessRrShort: 'Excess Rest & Recreation',
  arrExcessPujaShort: 'Excess Puja bonus',
  arrIncrementCalc: (next: string, old: string, inc: string) =>
    `1 increment (2015 scale) = ${next} (01-07-2026) − ${old} (30-06-2026) = ${inc}`,
  arrExcessRrRule: (inc: string) => `1 increment = ${inc}`,
  arrExcessPujaRule: (inc: string, total: string) => `2 increments = ${inc} × 2 = ${total}`,
  arrNoIncrement: 'The 30-06-2026 basic is the last stage of the 2015 scale, so there is no increment to deduct.',
  arrOneTime: 'one-time',

  gradePlaceholder: 'Select grade',
  basicPlaceholder: 'Select your basic',
  gradeFirst: 'Select the grade first',
  stepOption: (step: string) => `step ${step}`,
  basicHint: 'Select your grade first, then your basic on 30 June 2026 as on your pay slip.',
  gradeFound: (grade: string, step: string) => `Grade ${grade} · step ${step} of NPS 2015`,
  basicRequired: 'Select your basic on 30 June 2026 first.',
  gradeRequired: 'Choose your grade first.',
  moreOptions: 'More allowance options',
  moreOptionsHint: 'Post type, education, washing allowance, GPF',
  allowanceInputNote: 'Note: Allowances are calculated on your input.',
  calcFreeLeft: (left: string, total: string) => `Free arrears calculations left: ${left} of ${total}.`,
  calcNoFree: 'Your office has no free arrears calculations left. Request a bulk from the admin to calculate.',
  calcCounted: (n: string, per: string) =>
    `Every ${per} calculations without a T.R. Form download use 1 bill (${n} of ${per} counted).`,
  calcLimit: (free: string) =>
    `You have used your ${free} free arrears calculations. Request a bulk below to continue.`,
  calcChecking: 'Checking…',
  scaleDetails: 'Pay scales (NPS 2015 & NPS 2026)',
  summaryTitle: 'Your new basic',
  summarySub: (grade: string, basic: string) => `Grade ${grade} · Basic on 30 June 2026: ${basic}`,
  summaryAllowance: 'Total Allowance / month',
  calcArrears: 'Calculate arrears bill',
  billTitle: 'Arrears bill — 2026 pay fixation',
  billBasis: 'Basis of calculation',
  basisGrade: 'Grade',
  basisSubstantive: 'Substantive grade (for special allowance)',
  basisDrawn: 'Basic drawn (01-07-2026)',
  basisSpecial: 'Special allowance rate',
  basisHousing: 'House rent',
  basisHraProtection: 'House rent protection (June 2026 − July 2026, added to arrears)',
  basisMonths: 'Months',
  billMonthsHead: 'Month-by-month calculation',
  lineNewBasic: 'Basic (On Fixation 2026)',
  lineDrawn: 'Less: basic drawn (01-07-2026)',
  sameAs: (months: string, lead: string) => `${months}: same as ${lead}`,
  amountHead: 'Taka',
  printFooter: 'ProAssist | Developed by Office of the Controller General of Accounts (Accounts Section)',
  lineDiff: 'Difference (1 − 2)',
  lineSpecial: 'Less: special allowance',
  lineHra: 'Less: excess house rent',
  lineHraProtection: 'Add: house rent protection (June 2026 − July 2026)',
  lineNet: 'Net arrears (3 − 4 − 5)',
  lineNetProtection: 'Net arrears (3 − 4 + 5)',
  billSummary: 'Summary',
  billPdf: 'Download arrears bill PDF',
  trForm: 'Print T.R. Form 13',
  trFormName: (n: string) => `T.R. Form ${n}`,
  trFormDownload: (n: string) => `Download T.R. Form ${n}`,
  trFormDetails: (n: string) => `Details for T.R. Form ${n}`,
  downloadNow: 'Download PDF',
  downloading: 'Preparing PDF…',
  downloadFailed: 'Could not create the PDF here, so the print window was opened instead. Choose "Save as PDF" there.',
  printHintNameRequired: 'The employee name is required. Office and designation are optional.',
  nameRequired: 'Enter the employee name to download.',
  arrDialogTitle: 'Arrears bill details',
  arrDialogHint: 'Check these details before the arrears bill is calculated.',
  substantiveSame: (g: string) => `Same as grade ${g}`,
  billFormLabel: 'Bill form',
  billFormRule: 'T.R. Form 13 for substantive grades 1–10, T.R. Form 15 for 11–20.',
  accessTitle: 'Bill print Access',
  accessUseNote: (size: string) => `Bills are approved in bulks of ${size}. Each T.R. Form 13 / 15 download uses one bill.`,
  accessStatusApproved: 'Approved',
  accessStatusPending: 'Pending',
  accessStatusRejected: 'Not approved',
  accessStatusUsedUp: 'Used up',
  accessStatusNone: 'Approval needed',
  accessUnlimited: 'Admin account: no bill limit.',
  accessColSubmitted: 'Request submitted',
  accessColApproved: 'Approved',
  accessColUsed: 'Used',
  accessColRemaining: 'Remaining',
  accessSubmittedBills: (bills: string, bulks: string | null) =>
    bulks ? `${bulks} bulk(s) · ${bills} bills` : `${bills} bills`,
  accessWaiting: 'Waiting for approval',
  accessNoRequest: 'No pending request',
  accessBillsUnit: (n: string) => `${n} bills`,
  accessNone: 'You need admin approval to download T.R. Form 13 / 15.',
  accessRejected: 'Your last request was not approved.',
  accessUsedUp: (total: string) => `You have used all ${total} approved bills.`,
  accessAdminNote: 'Admin note',
  accessLoadError: 'Could not check your bill approval. Try again.',
  requestBulks: 'Number of bulks needed',
  requestBulkInfo: (size: string, total: string) => `1 bulk = ${size} bills · Total: ${total} bills`,
  requestNote: 'Note for the admin (optional)',
  requestNotePlaceholder: 'Office, purpose, or anything the admin should know',
  requestBtn: 'Send request',
  newBulkBtn: 'New bulk request',
  requestUpdateBtn: 'Send request for more Arrear Bill Download',
  requestSending: 'Sending…',
  requestSent: 'Request sent.',
  contactAdminHint: 'Call or WhatsApp the admin using the numbers below to get bulk access.',
  contactAdminNoNumbers: 'Please contact the admin to get bulk access.',
  requestDialogTitle: 'No Bill Print Access left',
  requestDialogHint: 'Send a new bulk request to the admin. You can download T.R. Form 13 / 15 once it is approved.',
  requestDialogPending: 'Your request is waiting for approval. You can update the number of bulks below.',
  ok: 'OK',
  retry: 'Retry',
  contactsTitle: 'Contact the admin for approval',
  contactName: 'Contact',
  contactNumber: 'Mobile number',
  whatsapp: 'WhatsApp',
  officeGateTitle: 'Select your office',
  officeGateIntro: 'Choose your circle and office to use the salary page. If your office is not listed, choose Others and type its name.',
  officeGateIntroListed: 'Choose your circle and office to use the salary page.',
  officeCircle: 'Circle',
  officeCirclePlaceholder: 'Select circle…',
  officeOptional: '(optional)',
  officeOffice: 'Office',
  officeOfficePlaceholder: 'Select your office…',
  officeCircleFirst: 'Select a circle first',
  officeOthers: 'My office is not in the list (Others)',
  officeOtherName: 'Full office name in English',
  officeOtherPlaceholder: 'e.g. Office of the Executive Engineer, PWD, Dhaka',
  officeOtherNameBn: 'Full office name in Bangla',
  officeOtherPlaceholderBn: 'যেমন: নির্বাহী প্রকৌশলীর কার্যালয়, গণপূর্ত বিভাগ, ঢাকা',
  officeOthersNotice:
    'Type the full office name in both Bangla and English. The Bangla name is printed on the bill forms (T.R. Form 13 / 15) and cannot be changed there.',
  officeLockNote: 'Once saved, you cannot change the office yourself. Contact the admin to change it.',
  officeAddBangla: 'Your office name is saved in English only. Add the full office name in Bangla to continue.',
  officeErrCircle: 'Select your circle.',
  officeErrOffice: 'Select your office, or choose Others.',
  officeErrOther: 'Type the full office name in English.',
  officeErrOtherBn: 'Type the full office name in Bangla (Bangla letters).',
  officeFixedOnBill: 'Set from your office; only the admin can change it.',
  officeLoadError: 'Could not load your office. Try again.',
  officeSave: 'Save and continue',
  officeSaving: 'Saving…',
  officeCancel: 'Cancel',
  officeYour: 'Office',
  officeNotSet: 'Not set',
  officeChange: 'Change',
  printTitle: 'Details for the PDF (optional)',
  printHint: 'These appear only on the PDF. Leave any of them blank to skip.',
  officeName: 'Office name',
  employeeName: 'Employee name',
  designation: 'Designation',
  nid: 'NID number',
  nidPlaceholder: '10, 13 or 17 digits (optional)',
  nidInvalid: 'NID number must be 10, 13 or 17 digits.',
  printPrivacyNote: 'This form information is only used in the bill form. It will not be sent to the system.',
  printNow: 'Create PDF',
  cancel: 'Cancel',
  preparedOn: 'Prepared on',
  arrBandStaff: 'office staff',
  staffBtn: 'Office Staff Arrear Bill',
  staffTitle: 'Office Staff Arrear Bill',
  staffHint:
    'Add each employee once. Only the details are saved; the arrears are always recalculated. Special allowance is 15% for all staff.',
  staffAdd: 'Add employee',
  staffAddTitle: 'Add employee',
  staffEditTitle: 'Update employee',
  staffName: 'Name',
  staffPost: 'Post',
  staffSave: 'Save',
  staffUpdate: 'Update',
  staffSaving: 'Saving…',
  staffEdit: 'Edit',
  staffDelete: 'Delete',
  staffDeleteConfirm: (name: string) => `Delete ${name} from the staff list?`,
  staffSavedNote: 'These details are saved in your account so you can update the staff bill later.',
  staffSpecialNote: 'Special allowance: 15% for all staff (no substantive grade needed).',
  staffEmpty: 'No employees yet. Add your office staff to prepare one T.R. Form 15 for all of them.',
  staffLoadError: 'Could not load the staff list.',
  staffColEmployee: 'Employee',
  staffColBasic: 'Basic (30-06-2026)',
  staffColHousing: 'Housing',
  staffColTotal: 'Total arrears',
  staffColDeduction: 'Deductions',
  staffColNet: 'Net arrears',
  staffTotalRow: (n: string) => `Total (${n} employees)`,
  staffStamp: (n: string) => `Stamp duty (৳ 10 × ${n})`,
  staffPayable: 'Payable after stamp duty',
  staffDownload: (n: string) => `Download T.R. Form 15 for ${n} staff`,
  staffBillsNeeded: (n: string, left: string) => `This download uses ${n} bills (one per employee). Bills left: ${left}.`,
  staffNeedMore: (n: string, left: string) =>
    `${n} employees need ${n} approved bills, but you have ${left}. Request more from the admin below.`,
  staffOfficeTitle: 'Office name for T.R. Form 15',
  staffOfficeHint: 'Printed on the form and on every attachment.',
  staffNameRequired: 'Enter the employee name.',
  staffPostRequired: 'Enter the post.',
  staffPdfFailed: 'Could not create the PDF. Press download again; the same staff list will not use bills twice.',
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
};

export type SalaryCopy = typeof salaryEn;

const salaryBn: SalaryCopy = {
  title: 'বেতন ২০২৬',
  brandSub: 'বেতন ক্যালকুলেটর',
  shareBtn: salaryEn.shareBtn,
  linkCopied: 'লিংক কপি হয়েছে — যে কাউকে শেয়ার করুন।',
  heroKicker: 'জাতীয় বেতনস্কেল',
  heroTitle: 'জাতীয় বেতনস্কেল-২০২৬-এ আপনার বকেয়া বিল ও মূল বেতন',
  heroBadge: 'নিট বকেয়াসহ প্রস্তুতকৃত বকেয়া বিল ডাউনলোড করুন',
  publishedNote: 'নিচে দেখানো জাতীয় বেতনস্কেল ২০২৬-এর রূপান্তর পর্যায়ের ভিত্তিতে।',
  rules: [
    [
      ['১. পর্যায়-১ (০১-০৭-২০২৬): ', true],
      ['স্টেপ ৫ = (স্টেপ ৪ − পুরাতন বেতন) × ', false],
      ['৪০%', true],
      [' (গ্রেড ১–৯) / ', false],
      ['৫০%', true],
      [' (গ্রেড ১০–২০); স্টেপ ৬ = পরবর্তী ধাপ − স্টেপ ৪; স্টেপ ৭ = পুরাতন বেতন + স্টেপ ৫ + স্টেপ ৬।', false],
    ],
    [
      ['২. পর্যায়-২ (০১-০১-২০২৭): ', true],
      ['একই স্টেপ; স্টেপ ৫-এর হার ', false],
      ['৭০%', true],
      [' (গ্রেড ১–৯) / ', false],
      ['৭৫%', true],
      [' (গ্রেড ১০–২০)।', false],
    ],
    [
      ['৩. পর্যায়-৩: ', true],
      ['০১-০৭-২০২৬-এর মূল বেতন = মিলে যাওয়া স্টেপ ৪-এর পরবর্তী ধাপ; ০১-০৭-২০২৭-এর মূল বেতন = তার পরবর্তী ধাপ।', false],
    ],
  ],
  currentPay: 'জাতীয় বেতনস্কেল ২০১৫ অনুসারে',
  grade: 'গ্রেড',
  basicJune: '৩০ জুন ২০২৬-এ মূল বেতন',
  fixedPay: 'নির্ধারিত বেতন',
  nps2015: 'বেতনস্কেল ২০১৫:',
  nps2026: 'বেতনস্কেল ২০২৬:',
  postType: 'পদের ধরন (গ্রেড ২–১০)',
  regular: 'নিয়মিত (ডিফল্ট)',
  currentCharge: 'চলতি দায়িত্ব — অতিরিক্ত ৳ ১,৫০০ / মাস',
  substantive: 'মূল গ্রেড (টিফিন, যাতায়াত ভাতা ও বকেয়ার জন্য)',
  substantiveNA: 'প্রযোজ্য নয় / গ্রেড ১১–১৫ নয়',
  substantiveHint:
    'গ্রেড ৭–১০: মূল গ্রেড ১১–১৫ হলে টিফিন ৳ ২০০ ও যাতায়াত ৳ ৩০০ প্রযোজ্য, এবং বকেয়ার বিশেষ ভাতা ১৫% হারে ধরা হয়।',
  housing: 'আবাসন',
  hraEligible: 'বাড়ি ভাড়া ভাতা প্রাপ্য (কর্মস্থলের এলাকা নির্বাচন করুন)',
  govtAccommodation: 'সরকারি বাসা বরাদ্দপ্রাপ্ত (বাড়ি ভাড়া ভাতা প্রদেয় নয়; বাড়ি ভাড়া কর্তন প্রযোজ্য হতে পারে)',
  hraArea: 'কর্মস্থল / বাড়ি ভাড়া এলাকা',
  education: 'শিক্ষা সহায়ক ভাতা (সন্তান)',
  educationOptions: ['নেই — ৳ ০', '১ সন্তান — ৳ ৫০০ / মাস', '২ সন্তান (সর্বোচ্চ) — ৳ ১,০০০ / মাস'],
  washing: 'ধোলাই ভাতা (ইউনিফর্মধারী ৪র্থ শ্রেণি)',
  no: 'না',
  washingYes: 'হ্যাঁ — ৳ ১০০ / মাস',
  gpf: 'জিপিএফ কর্তন (ঐচ্ছিক)',
  gpfPlaceholder: 'জিপিএফ-এর পরিমাণ লিখুন, যেমন ৫০০০',
  gpfHint: (amount) =>
    `শুধু ৩টি পর্যায়ের প্রতিটিতে প্রযোজ্য (মূল বেতন + মোট ভাতা − জিপিএফ → নিট প্রদেয়)${amount ? ` (জিপিএফ ${amount})` : ''}।`,
  grossNote:
    'চিকিৎসা ভাতা ৳ ১,৫০০ সবার জন্য অন্তর্ভুক্ত। টিফিন ৳ ২০০ ও যাতায়াত ৳ ৩০০ গ্রেড ১১–১৫-এর জন্য প্রযোজ্য (অথবা বেতন গ্রেড ৭–১০ হলে মূল গ্রেড ১১–১৫)। গ্রেড ২–১০-এ চলতি দায়িত্ব ভাতা ৳ ১,৫০০ যোগ হতে পারে। উৎসব ভাতা (বছরে ২× মূল বেতন), পহেলা বৈশাখ (২০%) এবং শ্রান্তি ও বিনোদন ভাতা (প্রতি ৩ বছরে ১× মূল বেতন) হিসাবের পর আলাদাভাবে দেখানো হয়।',
  calculate: salaryEn.calculate,
  calcError: 'হিসাব করা যায়নি',
  pdf: salaryEn.pdf,
  totalAllowance: 'মোট ভাতা (০১ জুন থেকে ৩১-১২-২০২৭)',
  grossSub: (grade, housing) => `৩০ জুন ২০২৬-এর মূল বেতনের ভিত্তিতে নির্ধারিত · গ্রেড ${grade} · আবাসন: ${housing}`,
  govtHousing: 'সরকারি বাসা',
  component: 'উপাদান',
  note: 'মন্তব্য',
  amount: 'পরিমাণ (৳)',
  basicShown: 'মূল বেতন (৩০ জুন ২০২৬) — দেখানো হয়েছে, যোগ করা হয়নি',
  basicRef: 'ভাতা হিসাবের ভিত্তি মূল বেতন',
  annualHead: 'বার্ষিক / পর্যায়ক্রমিক সুবিধা',
  stageTitle: (n, date) => `পর্যায়-${toBanglaDigits(n)} · ${date}`,
  step5Rate: (pct) => `স্টেপ ৫: ${pct}%`,
  stepCol: 'স্টেপ',
  descCol: 'বিবরণ',
  calcCol: 'হিসাব',
  oldBasic: 'পুরাতন মূল বেতন (৩০-০৬-২৬)',
  matched: 'মিলে যাওয়া ২০২৬ ধাপ',
  newBasic: (date) => `নতুন মূল বেতন (${date})`,
  basic2026: '০১-০৭-২০২৬-এর মূল বেতন',
  basic2027: '০১-০৭-২০২৭-এর মূল বেতন',
  nextStage: (amount) => `+ ${amount} (পরবর্তী ধাপ)`,
  lastStage: 'শেষ ধাপ — কোনো পরিবর্তন নেই',
  lastStageWarn: 'মিলে যাওয়া ধাপটি ২০২৬ স্কেলের শেষ ধাপ — স্টেপ ৬ = ০ (পরবর্তী ধাপ নেই)।',
  basic: 'মূল বেতন',
  basicNote: 'এই পর্যায়ের — মোট ভাতায় অন্তর্ভুক্ত নয়',
  fixedOnBasic: '৩০ জুন ২০২৬-এর মূল বেতনের ভিত্তিতে নির্ধারিত',
  basicPlusAllowance: 'মূল বেতন + মোট ভাতা',
  gpfDeduction: 'জিপিএফ কর্তন',
  netPayable: 'নিট প্রদেয়',
  netFormula: 'মূল বেতন + মোট ভাতা − জিপিএফ',
  thanksKicker: 'কৃতজ্ঞতা',
  thanksTitle: 'ধন্যবাদ, গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
  thanksText: [
    ['সকল সরকারি কর্মচারীর', true],
    [
      ' পক্ষ থেকে — প্রস্তাবিত জাতীয় বেতনস্কেল ২০২৬ এবং সারা দেশের সরকারি কর্মচারীদের জীবনমান ও মর্যাদা উন্নয়নে অব্যাহত প্রচেষ্টার জন্য আমরা কৃতজ্ঞতার সঙ্গে স্বীকৃতি জানাই।',
      false,
    ],
  ],
  thanksSign: '— সকল সরকারি কর্মচারী',
  footerTagline: 'বিধি, পরীক্ষা ও কমপ্লায়েন্স সহকারী',
  footerNote: 'বেতন ২০২৬ · বিনামূল্যের উন্মুক্ত টুল · যে কাউকে লিংক শেয়ার করুন',

  arrMonths: 'অন্তর্ভুক্ত মাস',
  arrPast: salaryEn.arrPast,
  arrAll: salaryEn.arrAll,
  arrClear: salaryEn.arrClear,
  arrSelectMonth: 'অন্তত একটি মাস নির্বাচন করুন।',
  arrBandHigh: 'গ্রেড ১০–২০',
  arrBandLow: 'গ্রেড ১–৯',
  arrHraNone: 'সরকারি বাসা — বাড়ি ভাড়া প্রদান করা হয়নি',
  arrColMonth: 'মাস',
  arrColNewBasic: 'প্রাপ্য মূল বেতন (বেতন স্কেল ২০২৬)',
  arrColDrawn: 'উত্তোলিত মূল বেতন (বেতন স্কেল ২০১৫ মোতাবেক)',
  arrColDiff: 'পার্থক্য',
  arrColSpecial: 'বিশেষ ভাতা',
  arrColHra: 'অতিরিক্ত বাড়ি ভাড়া',
  arrColHraProtection: 'বাড়ি ভাড়া সুরক্ষা',
  arrColNet: 'নিট বকেয়া',
  arrTotalRow: (n) => `মোট (${n} মাস)`,
  arrMathTitle: 'মোট প্রাপ্য বকেয়া',
  arrMathTotal: 'মোট বকেয়া',
  arrMathDeductions: 'বাদ: মোট কর্তন',
  arrMathNet: 'নিট বকেয়া',
  inWords: (words) => `কথায়: ${words}`,
  arrNegative: 'ঋণাত্মক হলে তা আদায়যোগ্য।',
  stageName: (n) => `পর্যায়-${toBanglaDigits(n)}`,
  arrExtraTitle: 'অন্যান্য কর্তন (বিলে প্রযোজ্য হলেই টিক দিন)',
  arrExtraHead: 'অন্যান্য কর্তন',
  arrExcessRr: 'অতিরিক্ত উত্তোলিত শ্রান্তি ও বিনোদন ভাতা কর্তন',
  arrExcessPuja: 'অতিরিক্ত উত্তোলিত পূজা বোনাস কর্তন',
  arrExcessRrShort: 'অতিরিক্ত শ্রান্তি ও বিনোদন ভাতা',
  arrExcessPujaShort: 'অতিরিক্ত পূজা বোনাস',
  arrIncrementCalc: (next, old, inc) =>
    `১টি ইনক্রিমেন্ট (২০১৫ স্কেল) = ${next} (০১-০৭-২০২৬) − ${old} (৩০-০৬-২০২৬) = ${inc}`,
  arrExcessRrRule: (inc) => `১টি ইনক্রিমেন্ট = ${inc}`,
  arrExcessPujaRule: (inc, total) => `২টি ইনক্রিমেন্ট = ${inc} × ২ = ${total}`,
  arrNoIncrement: '৩০-০৬-২০২৬ তারিখের মূল বেতন ২০১৫ স্কেলের শেষ ধাপ, তাই কর্তনের মতো কোনো ইনক্রিমেন্ট নেই।',
  arrOneTime: 'এককালীন',

  gradePlaceholder: 'গ্রেড নির্বাচন করুন',
  basicPlaceholder: 'মূল বেতন নির্বাচন করুন',
  gradeFirst: 'আগে গ্রেড নির্বাচন করুন',
  stepOption: (step) => `ধাপ ${step}`,
  basicHint: 'প্রথমে গ্রেড, তারপর বেতন বিবরণী অনুযায়ী ৩০ জুন ২০২৬-এর মূল বেতন নির্বাচন করুন।',
  gradeFound: (grade, step) => `গ্রেড ${grade} · বেতনস্কেল ২০১৫-এর ${step} নম্বর ধাপ`,
  basicRequired: 'প্রথমে ৩০ জুন ২০২৬-এর মূল বেতন নির্বাচন করুন।',
  gradeRequired: 'প্রথমে আপনার গ্রেড নির্বাচন করুন।',
  moreOptions: salaryEn.moreOptions,
  moreOptionsHint: 'পদের ধরন, শিক্ষা, ধোলাই ভাতা, জিপিএফ',
  allowanceInputNote: 'নোট: ভাতাসমূহ আপনার দেওয়া তথ্যের ভিত্তিতে হিসাব করা হয়েছে।',
  calcFreeLeft: (left, total) => `বিনামূল্যে বকেয়া হিসাব বাকি: ${total}টির মধ্যে ${left}টি।`,
  calcNoFree: 'আপনার অফিসের জন্য বিনামূল্যের কোনো বকেয়া হিসাব বাকি নেই। হিসাব করতে অ্যাডমিনের কাছে বাল্কের আবেদন করুন।',
  calcCounted: (n, per) => `টি.আর. ফরম ডাউনলোড ছাড়া প্রতি ${per}টি হিসাবে ১টি বিল ব্যবহৃত হবে (${per}টির মধ্যে ${n}টি গণনা হয়েছে)।`,
  calcLimit: (free) => `আপনার ${free}টি বিনামূল্যের বকেয়া হিসাব শেষ হয়েছে। চালিয়ে যেতে নিচ থেকে বাল্কের আবেদন করুন।`,
  calcChecking: salaryEn.calcChecking,
  scaleDetails: 'বেতনস্কেল (২০১৫ ও ২০২৬)',
  summaryTitle: 'আপনার নতুন মূল বেতন',
  summarySub: (grade, basic) => `গ্রেড ${grade} · ৩০ জুন ২০২৬-এ মূল বেতন: ${basic}`,
  summaryAllowance: 'মোট ভাতা / মাস',
  calcArrears: salaryEn.calcArrears,
  billTitle: 'বকেয়া বেতন ও ভাতাদি সমন্বয় — (বেতন স্কেল ২০২৬)',
  billBasis: 'হিসাবের ভিত্তি',
  basisGrade: 'গ্রেড',
  basisSubstantive: 'মূল গ্রেড (বিশেষ ভাতার জন্য)',
  basisDrawn: 'উত্তোলিত মূল বেতন (০১-০৭-২০২৬)',
  basisSpecial: 'বিশেষ ভাতার হার',
  basisHousing: 'বাড়ি ভাড়া',
  basisHraProtection: 'বাড়ি ভাড়া সুরক্ষা (জুন ২০২৬ − জুলাই ২০২৬, বকেয়ার সাথে যোগ)',
  basisMonths: 'মাস সমূহ',
  billMonthsHead: 'মাসভিত্তিক হিসাব',
  lineNewBasic: 'মূল বেতন (বেতন স্কেল ২০২৬)',
  lineDrawn: 'বাদ: উত্তোলিত মূল বেতন (০১-০৭-২০২৬)',
  sameAs: (months, lead) => `${months} এর প্রাপ্য বকেয়া: ${lead}-এর অনুরূপ`,
  amountHead: 'টাকা',
  printFooter: salaryEn.printFooter,
  lineDiff: 'পার্থক্য (১ − ২)',
  lineSpecial: 'বাদ: বিশেষ ভাতা',
  lineHra: 'বাদ: অতিরিক্ত বাড়ি ভাড়া',
  lineHraProtection: 'যোগ: বাড়ি ভাড়া সুরক্ষা (জুন ২০২৬ − জুলাই ২০২৬)',
  lineNet: 'নিট বকেয়া (৩ − ৪ − ৫)',
  lineNetProtection: 'নিট বকেয়া (৩ − ৪ + ৫)',
  billSummary: 'সারসংক্ষেপ',
  billPdf: salaryEn.billPdf,
  trForm: salaryEn.trForm,
  trFormName: (n) => `টি.আর. ফরম ${n}`,
  trFormDownload: salaryEn.trFormDownload,
  trFormDetails: (n) => `টি.আর. ফরম ${n}-এর তথ্য`,
  downloadNow: salaryEn.downloadNow,
  downloading: salaryEn.downloading,
  downloadFailed: 'এখানে পিডিএফ তৈরি করা যায়নি, তাই প্রিন্ট উইন্ডো খোলা হয়েছে। সেখানে "Save as PDF" নির্বাচন করুন।',
  printHintNameRequired: 'কর্মচারীর নাম আবশ্যক। অফিস ও পদবি ঐচ্ছিক।',
  nameRequired: 'ডাউনলোডের জন্য কর্মচারীর নাম লিখুন।',
  arrDialogTitle: 'বকেয়া বিলের তথ্য',
  arrDialogHint: 'বকেয়া বিল হিসাবের আগে তথ্যগুলো যাচাই করুন।',
  substantiveSame: (g) => `গ্রেড ${g}-এর অনুরূপ`,
  billFormLabel: 'বিল ফরম',
  billFormRule: 'মূল গ্রেড ১–১০ এর জন্য টি.আর. ফরম ১৩, ১১–২০ এর জন্য টি.আর. ফরম ১৫।',
  accessTitle: salaryEn.accessTitle,
  accessUseNote: (size) => `বিল ${size}টি করে বাল্কে অনুমোদন দেওয়া হয়। প্রতিবার টি.আর. ফরম ১৩ / ১৫ ডাউনলোডে একটি বিল ব্যবহৃত হবে।`,
  accessStatusApproved: 'অনুমোদিত',
  accessStatusPending: 'অপেক্ষমাণ',
  accessStatusRejected: 'অনুমোদিত হয়নি',
  accessStatusUsedUp: 'শেষ হয়েছে',
  accessStatusNone: 'অনুমোদন প্রয়োজন',
  accessUnlimited: 'অ্যাডমিন অ্যাকাউন্ট: বিলের কোনো সীমা নেই।',
  accessColSubmitted: 'আবেদন জমা',
  accessColApproved: 'অনুমোদিত',
  accessColUsed: 'ব্যবহৃত',
  accessColRemaining: 'অবশিষ্ট',
  accessSubmittedBills: (bills, bulks) => (bulks ? `${bulks}টি বাল্ক · ${bills}টি বিল` : `${bills}টি বিল`),
  accessWaiting: 'অনুমোদনের অপেক্ষায়',
  accessNoRequest: 'কোনো অপেক্ষমাণ আবেদন নেই',
  accessBillsUnit: (n) => `${n}টি বিল`,
  accessNone: 'টি.আর. ফরম ১৩ / ১৫ ডাউনলোডের জন্য অ্যাডমিনের অনুমোদন প্রয়োজন।',
  accessRejected: 'আপনার সর্বশেষ আবেদন অনুমোদিত হয়নি।',
  accessUsedUp: (total) => `আপনার অনুমোদিত ${total}টি বিলের সবগুলো ব্যবহৃত হয়েছে।`,
  accessAdminNote: 'অ্যাডমিনের মন্তব্য',
  accessLoadError: 'বিলের অনুমোদন যাচাই করা যায়নি। আবার চেষ্টা করুন।',
  requestBulks: 'প্রয়োজনীয় বাল্কের সংখ্যা',
  requestBulkInfo: (size, total) => `১ বাল্ক = ${size}টি বিল · মোট: ${total}টি বিল`,
  requestNote: 'অ্যাডমিনের জন্য মন্তব্য (ঐচ্ছিক)',
  requestNotePlaceholder: 'অফিস, উদ্দেশ্য বা অ্যাডমিনের জানা প্রয়োজন এমন কিছু',
  requestBtn: salaryEn.requestBtn,
  newBulkBtn: salaryEn.newBulkBtn,
  requestUpdateBtn: salaryEn.requestUpdateBtn,
  requestSending: salaryEn.requestSending,
  requestSent: 'আবেদন পাঠানো হয়েছে।',
  contactAdminHint: 'বাল্ক অনুমোদন পেতে নিচের নম্বরে অ্যাডমিনকে কল বা হোয়াটসঅ্যাপ করুন।',
  contactAdminNoNumbers: 'বাল্ক অনুমোদন পেতে অ্যাডমিনের সাথে যোগাযোগ করুন।',
  requestDialogTitle: 'বিল প্রিন্টের অনুমোদন অবশিষ্ট নেই',
  requestDialogHint: 'অ্যাডমিনের কাছে নতুন বাল্কের আবেদন পাঠান। অনুমোদনের পর টি.আর. ফরম ১৩ / ১৫ ডাউনলোড করতে পারবেন।',
  requestDialogPending: 'আপনার আবেদন অনুমোদনের অপেক্ষায় আছে। নিচে বাল্কের সংখ্যা পরিবর্তন করে আবার পাঠাতে পারেন।',
  ok: salaryEn.ok,
  retry: salaryEn.retry,
  contactsTitle: 'অনুমোদনের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন',
  contactName: 'যোগাযোগ',
  contactNumber: 'মোবাইল নম্বর',
  whatsapp: salaryEn.whatsapp,
  officeGateTitle: 'আপনার অফিস নির্বাচন করুন',
  officeGateIntro: 'বেতন পাতা ব্যবহারের জন্য আপনার সার্কেল ও অফিস নির্বাচন করুন। তালিকায় অফিস না থাকলে "অন্যান্য" নির্বাচন করে অফিসের নাম লিখুন।',
  officeGateIntroListed: 'বেতন পাতা ব্যবহারের জন্য আপনার সার্কেল ও অফিস নির্বাচন করুন।',
  officeCircle: 'সার্কেল',
  officeCirclePlaceholder: 'সার্কেল নির্বাচন করুন…',
  officeOptional: '(ঐচ্ছিক)',
  officeOffice: 'অফিস',
  officeOfficePlaceholder: 'আপনার অফিস নির্বাচন করুন…',
  officeCircleFirst: 'আগে সার্কেল নির্বাচন করুন',
  officeOthers: 'আমার অফিস তালিকায় নেই (অন্যান্য)',
  officeOtherName: 'অফিসের পূর্ণ নাম (ইংরেজিতে)',
  officeOtherPlaceholder: 'e.g. Office of the Executive Engineer, PWD, Dhaka',
  officeOtherNameBn: 'অফিসের পূর্ণ নাম (বাংলায়)',
  officeOtherPlaceholderBn: 'যেমন: নির্বাহী প্রকৌশলীর কার্যালয়, গণপূর্ত বিভাগ, ঢাকা',
  officeOthersNotice:
    'অফিসের পূর্ণ নাম বাংলা ও ইংরেজি দুই ভাষাতেই লিখুন। বাংলা নামটি বিল ফরমে (টি.আর. ফরম ১৩ / ১৫) ছাপা হবে এবং সেখানে পরিবর্তন করা যাবে না।',
  officeLockNote: 'একবার সংরক্ষণের পর আপনি নিজে অফিস পরিবর্তন করতে পারবেন না। পরিবর্তনের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।',
  officeAddBangla: 'আপনার অফিসের নাম শুধু ইংরেজিতে সংরক্ষিত আছে। চালিয়ে যেতে অফিসের পূর্ণ নাম বাংলায় লিখুন।',
  officeErrCircle: 'আপনার সার্কেল নির্বাচন করুন।',
  officeErrOffice: 'আপনার অফিস নির্বাচন করুন, অথবা "অন্যান্য" বেছে নিন।',
  officeErrOther: 'অফিসের পূর্ণ নাম ইংরেজিতে লিখুন।',
  officeErrOtherBn: 'অফিসের পূর্ণ নাম বাংলায় লিখুন (বাংলা অক্ষরে)।',
  officeFixedOnBill: 'আপনার অফিস থেকে নির্ধারিত; শুধু অ্যাডমিন পরিবর্তন করতে পারবেন।',
  officeLoadError: 'আপনার অফিসের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।',
  officeSave: salaryEn.officeSave,
  officeSaving: salaryEn.officeSaving,
  officeCancel: salaryEn.officeCancel,
  officeYour: 'অফিস',
  officeNotSet: 'নির্ধারিত নয়',
  officeChange: salaryEn.officeChange,
  printTitle: 'পিডিএফের জন্য তথ্য (ঐচ্ছিক)',
  printHint: 'এগুলো শুধু পিডিএফে দেখাবে। না চাইলে যেকোনোটি ফাঁকা রাখুন।',
  officeName: 'অফিসের নাম',
  employeeName: 'কর্মচারীর নাম',
  designation: 'পদবি',
  nid: 'এনআইডি নং',
  nidPlaceholder: '১০, ১৩ বা ১৭ অঙ্ক (ঐচ্ছিক)',
  nidInvalid: 'এনআইডি নম্বর ১০, ১৩ বা ১৭ অঙ্কের হতে হবে।',
  printPrivacyNote: 'এই ফর্মের তথ্য শুধু বিল ফর্মে ব্যবহার হবে, সিস্টেমে পাঠানো হবে না।',
  printNow: salaryEn.printNow,
  cancel: salaryEn.cancel,
  preparedOn: 'প্রস্তুতের তারিখ',
  arrBandStaff: 'অফিস স্টাফ',
  staffBtn: salaryEn.staffBtn,
  staffTitle: 'অফিস স্টাফের বকেয়া বিল',
  staffHint:
    'প্রত্যেক কর্মচারীকে একবার যোগ করুন। শুধু তথ্য সংরক্ষিত থাকবে, বকেয়া প্রতিবার নতুন করে হিসাব হবে। সকল স্টাফের বিশেষ সুবিধা ১৫%।',
  staffAdd: salaryEn.staffAdd,
  staffAddTitle: 'কর্মচারী যোগ করুন',
  staffEditTitle: 'কর্মচারীর তথ্য হালনাগাদ',
  staffName: 'নাম',
  staffPost: 'পদবি',
  staffSave: salaryEn.staffSave,
  staffUpdate: salaryEn.staffUpdate,
  staffSaving: salaryEn.staffSaving,
  staffEdit: salaryEn.staffEdit,
  staffDelete: salaryEn.staffDelete,
  staffDeleteConfirm: (name) => `${name}-কে স্টাফ তালিকা থেকে মুছে ফেলবেন?`,
  staffSavedNote: 'পরে স্টাফ বিল হালনাগাদ করার জন্য এই তথ্য আপনার অ্যাকাউন্টে সংরক্ষিত থাকবে।',
  staffSpecialNote: 'বিশেষ সুবিধা: সকল স্টাফের জন্য ১৫% (স্থায়ী গ্রেড লাগবে না)।',
  staffEmpty: 'এখনো কোনো কর্মচারী নেই। সবার জন্য একটি টি.আর. ফরম ১৫ তৈরি করতে অফিস স্টাফ যোগ করুন।',
  staffLoadError: 'স্টাফ তালিকা লোড করা যায়নি।',
  staffColEmployee: 'কর্মচারী',
  staffColBasic: 'মূল বেতন (৩০-০৬-২০২৬)',
  staffColHousing: 'বাসস্থান',
  staffColTotal: 'মোট বকেয়া',
  staffColDeduction: 'কর্তন',
  staffColNet: 'নিট বকেয়া',
  staffTotalRow: (n) => `মোট (${n} জন)`,
  staffStamp: (n) => `স্ট্যাম্প ডিউটি (৳ ১০ × ${n})`,
  staffPayable: 'স্ট্যাম্প ডিউটি বাদে প্রদেয়',
  staffDownload: salaryEn.staffDownload,
  staffBillsNeeded: (n, left) => `এই ডাউনলোডে ${n}টি বিল লাগবে (প্রতি কর্মচারী ১টি)। অবশিষ্ট বিল: ${left}।`,
  staffNeedMore: (n, left) => `${n} জন কর্মচারীর জন্য ${n}টি অনুমোদিত বিল প্রয়োজন, আপনার আছে ${left}টি। নিচে অ্যাডমিনের কাছে আরও অনুরোধ করুন।`,
  staffOfficeTitle: 'টি.আর. ফরম ১৫-এর জন্য অফিসের নাম',
  staffOfficeHint: 'ফর্মে ও প্রতিটি সংযুক্তিতে ছাপা হবে।',
  staffNameRequired: 'কর্মচারীর নাম লিখুন।',
  staffPostRequired: 'পদবি লিখুন।',
  staffPdfFailed: 'পিডিএফ তৈরি করা যায়নি। আবার ডাউনলোড চাপুন; একই স্টাফ তালিকার জন্য দ্বিতীয়বার বিল কাটা হবে না।',
  months: [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
  ],
};

export function salaryCopy(locale: SalaryLocale): SalaryCopy {
  return locale === 'bn' ? salaryBn : salaryEn;
}

export function localNum(locale: SalaryLocale, value: string | number): string {
  return locale === 'bn' ? toBanglaDigits(value) : String(value);
}

export function localTaka(locale: SalaryLocale, amount: number): string {
  return `৳ ${localNum(locale, formatTaka(amount))}`;
}

/** "YYYY-MM" → "July 2026" / "জুলাই ২০২৬". */
export function monthText(locale: SalaryLocale, key: string): string {
  const [y, m] = key.split('-');
  const name = salaryCopy(locale).months[Number(m) - 1];
  return name ? `${name} ${localNum(locale, y ?? '')}` : key;
}

const HRA_AREA_BN: Record<HraArea, string> = {
  dhaka: 'ঢাকা সিটি কর্পোরেশন এলাকা',
  major_city: 'চট্টগ্রাম, খুলনা, রাজশাহী, সিলেট, বরিশাল, রংপুর, নারায়ণগঞ্জ ও গাজীপুর সিটি কর্পোরেশন এবং সাভার পৌর এলাকা',
  other: 'অন্যান্য স্থান',
};

export const HRA_AREAS: HraArea[] = ['dhaka', 'major_city', 'other'];

export function hraAreaText(locale: SalaryLocale, area: HraArea): string {
  return locale === 'bn' ? HRA_AREA_BN[area] : hraAreaLabel(area);
}

export function housingText(locale: SalaryLocale, gross: EmployeeGrossResult): string {
  return gross.housing_status === 'govt_accommodation'
    ? salaryCopy(locale).govtHousing
    : hraAreaText(locale, gross.hra_area);
}

interface LineText {
  label: string;
  note?: string;
  calculation?: string;
}

function rateNoteBn(grade: number, pct: number): string {
  return `হার ${toBanglaDigits(pct)}% (গ্রেড ${grade >= 10 ? '১০–২০' : '১–৯'})`;
}

/** Bangla wording for a calculator step; English rows are returned unchanged. */
export function stepText(locale: SalaryLocale, result: Salary2026Result, row: Salary2026StepRow): LineText {
  if (locale !== 'bn') return row;
  const bn = (v: string | number) => toBanglaDigits(v);
  const date = bn(result.phase_label);
  const pct = bn(result.rate_percent);
  const calculation = row.calculation ? bn(row.calculation) : undefined;

  if (result.fixed) {
    if (row.step === 5) {
      return {
        label: `(নতুন নির্ধারিত বেতন − পুরাতন বেতন) × ${pct}%`,
        note: 'নির্ধারিত বেতন: স্টেপ ১–৪ ও ৬–৭ প্রযোজ্য নয়',
        calculation,
      };
    }
    return { label: `পুরাতন বেতন + স্টেপ ৫ (নতুন মূল বেতন) (${date})`, calculation };
  }

  switch (row.step) {
    case 1:
      return { label: 'পুরাতন বেতন − পুরাতন সর্বনিম্ন বেতন (৩০-০৬-২৬)', calculation };
    case 2:
      return { label: 'নতুন সর্বনিম্ন বেতন', note: 'এই গ্রেডের জন্য প্রকাশিত বেতনস্কেল ২০২৬-এর সর্বনিম্ন', calculation };
    case 3:
      return { label: 'নতুন সর্বনিম্ন + স্টেপ ১', calculation };
    case 4: {
      const step3 = result.steps.find((s) => s.step === 3)?.value;
      return {
        label: 'বেতনস্কেল ২০২৬-এ মিলে যাওয়া / পরবর্তী উচ্চতর ধাপ',
        note: step3 === row.value || step3 == null ? 'হুবহু ধাপ মিলেছে' : `${bn(formatTaka(step3))}-এর পরবর্তী উচ্চতর ধাপ`,
        calculation,
      };
    }
    case 5:
      return {
        label: `(স্টেপ ৪ − পুরাতন বেতন) × ${pct}%`,
        note: rateNoteBn(result.grade, result.rate_percent),
        calculation,
      };
    case 6:
      return {
        label: `পরবর্তী ধাপ − স্টেপ ৪ (ফ্যাক্ট ইনক্রিমেন্ট ${date})`,
        note: result.increment_skipped
          ? 'শেষ ধাপ — পরবর্তী ধাপ নেই (স্টেপ ৬ = ০)'
          : `পরবর্তী ধাপ ${bn(formatTaka((result.matched_new_stage ?? 0) + row.value))} − স্টেপ ৪`,
        calculation,
      };
    case 7:
      return { label: `পুরাতন বেতন + স্টেপ ৫ + স্টেপ ৬ (নতুন মূল বেতন) (${date})`, calculation };
    default:
      return { label: row.label, note: row.note, calculation };
  }
}

/** Bangla wording for an allowance / benefit line; English rows are returned unchanged. */
export function allowanceText(locale: SalaryLocale, row: AllowanceLine, gross: EmployeeGrossResult): LineText {
  if (locale !== 'bn') return row;
  const bn = (v: string | number) => toBanglaDigits(v);
  const eligibleGrade = row.note?.match(/Grade (\d+)/)?.[1];
  const gradeNote =
    row.amount > 0 && eligibleGrade
      ? `প্রাপ্য — মূল/বেতন গ্রেড ${bn(eligibleGrade)} (১১–১৫)`
      : 'প্রযোজ্য নয় (গ্রেড ১১–১৫ প্রয়োজন)';

  switch (row.code) {
    case 'hra':
      return gross.housing_status === 'govt_accommodation'
        ? {
            label: 'বাড়ি ভাড়া ভাতা',
            note: 'প্রাপ্য নয় — সরকারি বাসা। বিধি অনুযায়ী মূল বেতনের একটি অংশ কর্তন হতে পারে।',
          }
        : {
            label: `বাড়ি ভাড়া ভাতা (${HRA_AREA_BN[gross.hra_area]})`,
            note: `মূল বেতনের ${bn(gross.hra_rate_percent)}% (সর্বনিম্ন ৳ ${bn(formatTaka(gross.hra_minimum))})`,
          };
    case 'medical':
      return { label: 'চিকিৎসা ভাতা', note: 'সাধারণ কর্মকর্তা ও কর্মচারী' };
    case 'education':
      return {
        label: 'শিক্ষা সহায়ক ভাতা',
        note: row.amount >= 1000 ? '২ সন্তান (সর্বোচ্চ)' : row.amount > 0 ? '১ সন্তান' : 'কোনো সন্তান নির্বাচন করা হয়নি',
      };
    case 'current_charge':
      return { label: 'চলতি দায়িত্ব ভাতা', note: 'গ্রেড ২–১০ — অতিরিক্ত চলতি দায়িত্ব' };
    case 'tiffin':
      return { label: 'টিফিন ভাতা', note: gradeNote };
    case 'washing':
      return { label: 'ধোলাই ভাতা', note: row.amount > 0 ? 'ইউনিফর্মধারী ৪র্থ শ্রেণির কর্মচারী' : 'নির্বাচন করা হয়নি' };
    case 'conveyance':
      return { label: 'যাতায়াত ভাতা', note: gradeNote };
    case 'festival':
      return { label: 'উৎসব ভাতা (বছরে ২টি উৎসব)', note: 'মূল বেতনের ১০০% × ২' };
    case 'baishakh':
      return { label: 'বাংলা নববর্ষ ভাতা (পহেলা বৈশাখ)', note: 'মূল বেতনের ২০% (প্রতি বছর এপ্রিলে প্রদেয়)' };
    case 'rest_recreation':
      return { label: 'শ্রান্তি ও বিনোদন ভাতা (প্রতি ৩ বছরে)', note: '১ মাসের মূল বেতন + পূর্ণ গড় বেতনে ১৫ দিনের ছুটি' };
    default:
      return row;
  }
}
