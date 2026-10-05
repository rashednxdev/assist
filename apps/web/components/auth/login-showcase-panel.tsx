import Image from 'next/image';
import { CalendarRange, Languages, Printer, ShieldCheck } from 'lucide-react';
import { NPS_2015, calculateSalaryArrears, formatTaka } from '@ibas/shared-types';
import { toBanglaDigits } from '@/lib/bangla-format';
import { takaInWords } from '@/lib/amount-words';

const STAMP_DUTY = 10;

const SAMPLE = calculateSalaryArrears({
  grade: 9,
  old_pay: NPS_2015[9][2]!,
  housing_status: 'hra_eligible',
  hra_area: 'dhaka',
  months: ['2026-07', '2026-08', '2026-09'],
});

const FEATURES = [
  { icon: CalendarRange, text: 'Month-by-month arrears, same months grouped' },
  { icon: ShieldCheck, text: 'House rent rules & July 2026 protection' },
  { icon: Printer, text: 'T.R. Form 13 with stamp duty, ready to print' },
  { icon: Languages, text: 'বাংলা ও English' },
];

const STEPS = [
  'Enter grade, basic on 30 June, housing & substantive grade',
  'Get Bill print Access from the admin',
  'Download T.R. Form 13 / 15',
];

const tk = (n: number) => formatTaka(n);
const bnTk = (n: number) => toBanglaDigits(formatTaka(n));

function ArrearsBillPaper() {
  const row = SAMPLE.rows[0]!;
  const protection = row.hra_protection > 0;
  const lines: Array<[string, string, 'minus' | 'plus' | 'sum' | 'net' | undefined]> = [
    ['Basic (On Fixation 2026)', tk(row.new_basic), undefined],
    ['Less: basic drawn (01-07-2026)', `− ${tk(row.drawn_basic)}`, 'minus'],
    ['Difference (1 − 2)', tk(row.basic_difference), 'sum'],
    ['Less: special allowance', `− ${tk(row.special_allowance)}`, 'minus'],
    protection
      ? ['Add: house rent protection', `+ ${tk(row.hra_protection)}`, 'plus']
      : ['Less: excess house rent', `− ${tk(row.excess_hra)}`, 'minus'],
    ['Net arrears', tk(row.net_arrear), 'net'],
  ];

  return (
    <div className="w-[264px] overflow-hidden rounded-lg bg-white 2xl:w-[300px] text-slate-800 shadow-2xl ring-1 ring-black/5">
      <div className="bg-indigo-700 px-3 py-2 text-[11px] font-bold text-white">Arrears bill — Pay Scale 2026</div>
      <div className="space-y-2 p-3">
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>Grade {SAMPLE.grade} · Dhaka</span>
          <span>Jul – Sep 2026</span>
        </div>
        <div className="overflow-hidden rounded border border-slate-200">
          <div className="flex justify-between bg-slate-50 px-2 py-1 text-[10px] font-bold">
            <span>July 2026</span>
            <span className="font-semibold text-slate-500">Taka</span>
          </div>
          {lines.map(([label, value, tone], i) => (
            <div
              key={label}
              className={`flex justify-between border-t border-slate-100 px-2 py-[3px] text-[9.5px] ${
                tone === 'net' ? 'bg-indigo-50 font-bold' : tone === 'sum' ? 'font-semibold' : ''
              }`}
            >
              <span>
                <span className="mr-1 text-slate-400">{i + 1}.</span>
                {label}
              </span>
              <span
                className={`font-mono ${
                  tone === 'minus' ? 'text-rose-600' : tone === 'plus' ? 'text-emerald-600' : 'text-slate-900'
                }`}
              >
                {value}
              </span>
            </div>
          ))}
          <div className="border-t border-slate-100 bg-amber-50 px-2 py-1 text-[9px] font-medium text-amber-900">
            August 2026, September 2026: same as July 2026
          </div>
        </div>
        <div className="rounded border border-indigo-200 bg-indigo-100/70 px-2 py-1.5 text-[10px] font-bold text-indigo-950">
          Total arrears due: ৳ {tk(SAMPLE.total_net_arrear)}
        </div>
      </div>
    </div>
  );
}

function TrFormPaper() {
  const payable = SAMPLE.total_net_arrear - STAMP_DUTY;
  const rows: Array<[string, string, string]> = [
    ['৩১১১১০১', 'মূল বেতন (অফিসার) (বেতনস্কেল ২০২৬ এর বকেয়া)', bnTk(SAMPLE.total_net_arrear)],
    ['৩১১১৩১০', 'বাড়িভাড়া ভাতা', ''],
    ['', 'সর্বমোট বেতন ও ভাতা (ক)', bnTk(SAMPLE.total_net_arrear)],
    ['১১৬২১০১', 'স্ট্যাম্প ডিউটি', bnTk(STAMP_DUTY)],
    ['৮১৭২১০৮', 'প্রদেয় বিল (ক-খ)', bnTk(payable)],
  ];

  return (
    <div lang="bn" className="w-[264px] rounded-lg 2xl:w-[300px] bg-[#fffdf7] p-3 text-slate-800 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-start justify-between text-[8px] text-slate-500">
        <span>টি, আর, ফরম নং ১৩</span>
        <span>[এস, আর, ১৩৯ (১) দ্রষ্টব্য]</span>
      </div>
      <p className="mt-1 text-center text-[11px] font-bold">গেজেটেড সরকারি কর্মকর্তার বেতন বিল</p>
      <p className="text-center text-[8.5px] text-slate-500">জুলাই – সেপ্টেম্বর ২০২৬</p>
      <table className="mt-2 w-full border-collapse text-[8.5px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-1 py-0.5 text-left font-semibold">কোড</th>
            <th className="border border-slate-300 px-1 py-0.5 text-left font-semibold">বিবরণ</th>
            <th className="border border-slate-300 px-1 py-0.5 text-right font-semibold">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([code, label, amount], i) => (
            <tr key={i} className={i === 2 || i === 4 ? 'bg-emerald-50 font-semibold' : undefined}>
              <td className="border border-slate-300 px-1 py-0.5 font-mono">{code}</td>
              <td className="border border-slate-300 px-1 py-0.5">{label}</td>
              <td className="border border-slate-300 px-1 py-0.5 text-right font-mono">{amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[8.5px] leading-snug">
        টাকা (কথায়): <strong>{takaInWords('bn', payable)}</strong>
      </p>
    </div>
  );
}

/** Login page showcase: sample arrears bill and T.R. Form 13 worked out by the live calculator. */
export function LoginShowcasePanel() {
  return (
    <div className="relative hidden flex-[1.6] flex-col justify-between gap-8 overflow-hidden bg-gradient-to-br from-[#0b3d2e] via-emerald-800 to-teal-700 p-10 text-white lg:flex">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative flex items-center gap-3">
        <Image src="/brand/proassist-logo.png" alt="ProAssist" width={44} height={44} className="h-11 w-11 rounded-xl" priority />
        <div>
          <p className="text-xl font-bold">ProAssist</p>
          <p className="text-sm text-emerald-100/80">Pay · Rules · Exams</p>
        </div>
      </div>

      <div className="relative grid gap-10 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="max-w-md space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            New · Pay Scale 2026
          </span>
          <h2 className="text-3xl font-extrabold leading-tight 2xl:text-4xl">
            Arrears bill &amp; T.R. Form 13, <span className="text-emerald-300">ready in minutes</span>
          </h2>
          <p className="text-emerald-50/85">
            Pick your grade and basic. ProAssist works out every month of your 2026 pay-fixation arrears and fills
            T.R. Form 13 for you to print and submit.
          </p>
          <ul className="grid gap-2.5 text-sm">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4 text-emerald-200" />
                </span>
                <span className="text-emerald-50/90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto hidden h-[430px] w-[360px] shrink-0 xl:block 2xl:h-[470px] 2xl:w-[440px]">
          <div className="absolute right-0 top-2 rotate-[4deg] transition-transform duration-500 hover:z-20 hover:rotate-0 hover:scale-105">
            <TrFormPaper />
          </div>
          <div className="absolute bottom-0 left-0 z-10 -rotate-[3deg] transition-transform duration-500 hover:rotate-0 hover:scale-105">
            <ArrearsBillPaper />
          </div>
          <span className="absolute left-2 top-0 z-30 rounded-full bg-amber-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow">
            Sample preview
          </span>
        </div>
      </div>

      <div className="relative rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/15">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
          Arrears bill in 3 steps
        </p>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step} className="relative flex items-start gap-2 sm:flex-col sm:gap-2">
              {i < STEPS.length - 1 ? (
                <span className="absolute left-[calc(1.75rem+0.5rem)] right-0 top-3.5 hidden h-px bg-white/20 sm:block" />
              ) : null}
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-xs font-bold text-emerald-950 shadow">
                {i + 1}
              </span>
              <span className="text-xs leading-snug text-emerald-50/90">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
