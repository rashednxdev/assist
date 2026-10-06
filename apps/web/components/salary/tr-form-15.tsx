'use client';

import { forwardRef } from 'react';
import type { HraArea, SalaryArrearResult } from '@ibas/shared-types';
import { takaInWords } from '@/lib/amount-words';
import { toBanglaDigits } from '@/lib/bangla-format';
import type { SalaryPrintInfo } from '@/components/salary/salary-print-dialog';
import {
  CodeRow,
  Dots,
  STAMP_DUTY,
  STAMP_DUTY_CODE,
  Signature,
  TotalRow,
  TrAttachment,
  periodText,
  taka,
  type FormRow,
} from '@/components/salary/tr-form-parts';
import { monthText } from '@/lib/salary-i18n';

const PAY_ROWS: FormRow[] = [
  { code: '৩১১১২০১', label: 'মূল বেতন (কর্মচারী) (বেতনস্কেল ২০২৬ এর বকেয়া)' },
  { code: '৩১১১৩০৬', label: 'শিক্ষা ভাতা' },
  { code: '৩১১১৩১০', label: 'বাড়িভাড়া ভাতা' },
  { code: '৩১১১৩১১', label: 'চিকিৎসা ভাতা' },
  { code: '৩১১১৩০২', label: 'যাতায়াত ভাতা' },
  { code: '৩১১১৩১৪', label: 'টিফিন ভাতা' },
  { code: '৩১১১৩০৮', label: 'ঝুঁকি ভাতা' },
  { code: '৩১১১৩১৫', label: 'পোশাক ভাতা' },
  { code: '৩১১১৩১৬', label: 'ধোলাই ভাতা' },
  { code: '', label: '' },
  { code: '', label: '' },
  { code: '', label: '' },
];

const DEDUCTION_ROWS: FormRow[] = [
  { code: '১১১১১০২', label: 'ব্যক্তি কর্তৃক দেয় অগ্রিম আয়কর' },
  { code: '১১৬২১০১', label: 'স্ট্যাম্প ডিউটি' },
  { code: '১৪১১২০২', label: 'সরকারি কর্মচারীকে প্রদত্ত ঋণের সুদ' },
  { code: '১৪২২৪০৪', label: 'পানি ও পয়ঃনিষ্কাশন ব্যবস্থা চার্জ' },
  { code: '১৪৪১২০৪', label: 'পৌরকর' },
  { code: '৭২১৫১০১', label: 'গৃহনির্মাণ ঋণ' },
  { code: '৭২১৫১০৫', label: 'মোটর সাইকেল ঋণ' },
  { code: '৭২১৫১০২', label: 'কম্পিউটার ঋণ' },
  { code: '৮১১২২০১', label: 'সাধারণ ভবিষ্য তহবিল (সিভিল)' },
  { code: '৮১১২২০১', label: 'ভবিষ্য তহবিলের অগ্রিম ও সুদ আদায়' },
  { code: '৮১৭২৪০১', label: 'তিতাস গ্যাস' },
  { code: '৮১৭২৪০২', label: 'বাখরাবাদ গ্যাস বিল' },
  { code: '৮১৭২৪০৩', label: 'জালালাবাদ গ্যাস বিল' },
  { code: '৮১৭২৪০৪', label: 'কর্ণফুলী গ্যাস বিল' },
  { code: '৮১৭২৫০৩', label: 'কর্মচারী কল্যাণ তহবিল' },
  { code: '৮১৭২৫০৪', label: 'কর্মচারী যৌথবিমা তহবিল' },
  { code: '৮১১৩১১০', label: 'স্থানীয় তহবিল জমা' },
  { code: '', label: '' },
  { code: '', label: '' },
  { code: '', label: '' },
  { code: '', label: '' },
];

const INSTRUCTIONS = [
  'অবিলিকৃত/স্থগিত টাকা যথাযথ কলামে লাল কালিতে লিখতে হবে এবং যোগ করার সময় তা বাদ রাখতে হবে।',
  'অনুপস্থিত কর্মচারীগণের তালিকায় স্থান পায়নি এমন ঘটনাসমূহ যথা-মৃত্যু, অবসরগ্রহণ, স্থায়ী বদলি ও প্রথম নিয়োগ ‘মন্তব্য’ কলামে লিখতে হবে।',
  'অধস্তন সরকারি কর্মচারী এবং এস. আর. ১৫২ তে উল্লেখিত সরকারি কর্মচারীদের নাম বেতনের বিলে বাদ দেওয়া যেতে পারে।',
  'সেরেস্তার প্রত্যেক শাখার পর পাতায় আড়াআড়ি লাল রেখা টানতে হবে এবং তার নিচে বেতন ও ভাতার সমষ্টি বেতন ও ভাতার কলামে লাল কালিতে প্রদর্শন করতে হবে।',
  'স্থায়ী পদে নিযুক্ত ব্যক্তিদের নাম স্থায়ী পদের বেতন গ্রহণের মাপকাঠিতে জ্যেষ্ঠত্বের ক্রমঅনুসারে লিখতে হবে এবং খালি পদসমূহ স্থানাপন্ন লোকদেরকে দেখাতে হবে।',
  'বেতন বিলে কর্তন ও আদায়ের পৃথক পৃথক শিডিউল বেতনের বিলে সংযুক্ত করতে হবে।',
];

const CERTIFICATES = [
  'বিলের সাথে একটি অনুপস্থিতির তালিকা প্রদান করা হলো।',
  'প্রত্যয়ন করা যাচ্ছে যে, এই কার্যালয়ের সকল নিয়োগ, স্থায়ী ও অস্থায়ী পদোন্নতি সংক্রান্ত তথ্যাদি সংশ্লিষ্ট কর্মচারীগণের নিজ নিজ চাকুরি বইতে আমার সত্যায়নে লিপিবদ্ধ হয়েছে।',
  'প্রত্যয়ন করা যাচ্ছে যে, চাকুরি বইতে রক্ষিত ছুটির হিসাব এবং প্রযোজ্য ছুটির বিধি অনুযায়ী প্রাপ্য ছুটি ছাড়া কাউকেও কোন ছুটি মঞ্জুর করা হয়নি। আমি নিশ্চিত যে, তাদের ছুটি পাওনা ছিল এবং সকল ছুটির মঞ্জুর ও ছুটিতে বা ছুটি থেকে ফিরে আসা, সাময়িক কর্মচ্যুতি ও অন্য কাজে যাওয়া ও অন্যান্য ঘটনা নিয়ম মোতাবেক চাকুরি বইতে এবং ছুটির হিসাবে আমার সত্যায়নে লিপিবদ্ধ করা হয়েছে।',
  'প্রত্যয়ন করা যাচ্ছে যে, যে সকল সরকারি কর্মচারীর নাম উল্লেখ করে এই বিলে বেতন দাবি করা হয়েছে, চলতি মাসে তারা যথার্থই সরকারি চাকুরিতে নিয়োজিত ছিলেন।',
  'প্রত্যয়ন করা যাচ্ছে যে, যে সকল সরকারি কর্মচারীর বাড়িভাড়া ভাতা এই বিলে দাবি করা হয়েছে, তারা সরকারি কোন বাসস্থানে বসবাস করেন নি।',
  'প্রত্যয়ন করা যাচ্ছে যে, যে ক্ষেত্রে ছুটির/অস্থায়ী বদলিকালীন ক্ষতিপূরণ ভাতা দাবি করা হয়েছে, সেক্ষেত্রে কর্মচারীর একই বা স্বপদে ফিরে আসার সম্ভাব্যতা ছুটি/ অস্থায়ী বদলির মূল আদেশে লিপিবদ্ধ করা হয়েছে।',
  'প্রত্যয়ন করা যাচ্ছে যে, কর্মচারীদের ছুটিকালীন বেতন, ছুটিতে যাওয়ার সময় যে হারে বেতন গ্রহণ করেছেন, সেই হারে দাবি করা হয়েছে।',
  'প্রত্যয়ন করা যাচ্ছে যে, অবসর গ্রহণ করেছেন এমন কোন কর্মচারীর নাম এই বিলে অন্তর্ভুক্ত করা হয়নি।',
];

/** The two printed pages of T.R. Form No. 15 with the pay total, stamp duty and payable filled in. */
function TrForm15Pages({
  months,
  office,
  netTotal,
  stamp,
  payable,
  payableWords,
  headBox,
}: {
  months: string[];
  office: string;
  netTotal: number;
  stamp: number;
  payable: number;
  payableWords: string;
  headBox: React.ReactNode;
}) {
  const period = periodText(months);
  const payRows = PAY_ROWS.map((row, i) => (i === 0 ? { ...row, amount: netTotal } : row));
  const deductionRows = DEDUCTION_ROWS.map((row) => (row.code === STAMP_DUTY_CODE ? { ...row, amount: stamp } : row));

  return (
    <>
      <section className="tr-page">
        <div className="tr-head">
          <div className="tr-head-ref">
            <div>টি, আর, ফরম নং ১৫</div>
            <div>[এস. আর. ১৫০ (১) দ্রষ্টব্য]</div>
          </div>
          <div className="tr15-person">{headBox}</div>
          <div className="tr-head-main">
            <div className="tr-title">সংস্থাপন কর্মচারীগণের বেতনের বিল</div>
            <div className="tr-head-line">
              <Dots value={period.month} width="44mm" /> মাসের <Dots value={period.year} width="34mm" />
            </div>
            <div className="tr-head-line">
              দপ্তরের নাম : <Dots value={office} width="80mm" />
            </div>
            <div className="tr-head-line">
              প্রাতিষ্ঠানিক/ অপারেশন কোড *{' '}
              <span className="tr-code-boxes">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} />
                ))}
              </span>
            </div>
          </div>
        </div>

        <div className="tr-fields">
          <div>
            টোকেন নং <Dots width="30mm" /> তারিখ <Dots width="32mm" /> ভাউচার নং <Dots width="30mm" /> তারিখ{' '}
            <Dots width="30mm" />
          </div>
        </div>

        <div className="tr15-body">
          <div className="tr15-notes">
            <div className="tr15-notes-head">নির্দেশাবলি</div>
            <ol>
              {INSTRUCTIONS.map((text, i) => (
                <li key={i}>
                  <span>{toBanglaDigits(i + 1)}।</span> {text}
                </li>
              ))}
            </ol>
          </div>
          <table className="tr-grid">
            <colgroup>
              <col style={{ width: '6mm' }} />
              <col style={{ width: '20mm' }} />
              <col />
              <col style={{ width: '22mm' }} />
              <col style={{ width: '11mm' }} />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={2}>অর্থনৈতিক কোড</th>
                <th>বিবরণ</th>
                <th>টাকা</th>
                <th>পয়সা</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="tr-section">
                  বেতন ও ভাতা
                </td>
              </tr>
              {payRows.map((row, i) => (
                <CodeRow key={`p${i}`} row={row} rate={false} />
              ))}
              <TotalRow label="মোট বেতন ও ভাতা (ক)" amount={netTotal} rate={false} />
              <tr>
                <td colSpan={5} className="tr-section">
                  কর্তন ও পরিশোধ
                </td>
              </tr>
              {deductionRows.map((row, i) => (
                <CodeRow key={`d${i}`} row={row} rate={false} />
              ))}
              <TotalRow label="কর্তন ও পরিশোধ বাবদ মোট আদায় (খ)" amount={stamp} rate={false} />
              <CodeRow row={{ code: '৮১৭২১০৮', label: 'প্রদেয় বিল (ক-খ)', amount: payable }} rate={false} />
              <tr>
                <td colSpan={5} className="tr-words">
                  টাকা (কথায়) : <strong>{payableWords}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="tr15-foot">
          <p className="tr-footnote">
            * প্রতিষ্ঠানের ক্ষেত্রে ০৬ ডিজিট এবং বিশেষ কার্যক্রম/ প্রজেক্ট/ স্কিম-এর ক্ষেত্রে সাত (০৭) ডিজিটের কোড ব্যবহার করতে হবে।
          </p>
          <span className="tr-small">[অপর পৃষ্ঠা দ্রষ্টব্য]</span>
        </div>
      </section>

      <section className="tr-page">
        <div className="tr-page-no">২</div>
        <ol className="tr15-certs">
          <li>
            <span>১.</span>
            <div>
              <div>(ক) বিলের টাকা বুঝে পেলাম।</div>
              <div>
                (খ) প্রত্যয়ন করছি যে, নিম্নে বিশদভাবে বর্ণিত টাকা (যা এই বিল হতে কর্তন করে ফেরত দেওয়া হয়েছে) ব্যতীত এই তারিখের
                ১মাস/২মাস/৩মাস পূর্বে উত্তোলিত বিলের অন্তর্ভুক্ত টাকা যথার্থ ব্যক্তিদের প্রদান করা হয়েছে। (প্রযোজ্য ক্ষেত্রে টিক চিহ্ন (✓)
                দিন)।
              </div>
              <div>
                (গ) প্রত্যয়ন করছি যে, কর্মচারীদের নিকট হতে স্ট্যাম্প ডিউটি বেতন বিল হতে কর্তন/ অর্থ প্রাপ্তির স্ট্যাম্পসহ রশিদ গ্রহণ করে
                বেতন বইতে সংরক্ষণ করা হয়েছে।
              </div>
            </div>
          </li>
          {CERTIFICATES.map((text, i) => (
            <li key={i}>
              <span>{toBanglaDigits(i + 2)}.</span>
              <div>{text}</div>
            </li>
          ))}
        </ol>

        <div className="tr-p2-heading tr15-absent-head">অনুপস্থিত ব্যক্তিদের ফেরত দেওয়া বেতনের বিবরণ</div>
        <table className="tr-grid tr15-absent">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col />
            <col style={{ width: '16%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>সেকসন</th>
              <th rowSpan={2}>নাম</th>
              <th rowSpan={2}>সময়</th>
              <th colSpan={2}>টাকার অঙ্ক</th>
            </tr>
            <tr>
              <th>টাকা</th>
              <th>পয়সা</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tr15-absent-body">
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>

        <div className="tr15-sign-block">
          <div className="tr15-sign-left">
            <div>
              স্থান <Dots width="48mm" />
            </div>
            <div>
              তারিখ <Dots width="46mm" />
            </div>
          </div>
          <div className="tr15-sign-right">
            <div>
              আয়ন কর্মকর্তার স্বাক্ষর <Dots width="52mm" />
            </div>
            <div>
              নাম <Dots width="70mm" />
            </div>
            <div>
              পদবি <Dots width="68mm" />
            </div>
            <div>
              সিল <Dots width="40mm" />
            </div>
          </div>
        </div>

        <div className="tr15-office">
          <div className="tr-p2-heading">হিসাবরক্ষণ অফিসে ব্যবহারের জন্য</div>
          <div className="tr-p2-row">
            প্রদানের জন্য পাস করা হল, টাকা <Dots width="48mm" /> কথায় <Dots width="78mm" />
          </div>
          <div className="tr-p2-signs">
            <Signature title="অডিটর (স্বাক্ষর)" lines={['নাম ......................', 'তাং ......................', 'সিল']} />
            <Signature title="সুপার (স্বাক্ষর)" lines={['নাম ......................', 'তাং ......................', 'সিল']} />
            <Signature
              title="নিরীক্ষা ও হিসাবরক্ষণ অফিসার (স্বাক্ষর)"
              lines={['নাম ......................', 'তাং ......................', 'সিল']}
            />
          </div>
        </div>
      </section>
    </>
  );
}

/** T.R. Form No. 15 (establishment pay bill, substantive grades 11–20) filled with the arrears totals, plus a summary attachment. */
export function TrForm15({
  result,
  hraArea,
  info,
  preparedOn,
}: {
  result: SalaryArrearResult;
  hraArea: HraArea;
  info: SalaryPrintInfo;
  preparedOn: string;
}) {
  const payable = result.total_net_arrear - STAMP_DUTY;
  const payableWords = takaInWords('bn', payable);

  return (
    <div className="salary-tr-form tr15 hidden" lang="bn">
      <TrForm15Pages
        months={result.rows.map((r) => r.month)}
        office={info.office}
        netTotal={result.total_net_arrear}
        stamp={STAMP_DUTY}
        payable={payable}
        payableWords={payableWords}
        headBox={
          <>
            <div>
              নামঃ <Dots value={info.employee} width="38mm" />
            </div>
            {info.nid ? (
              <div>
                এনআইডি নংঃ <Dots value={toBanglaDigits(info.nid)} width="30mm" />
              </div>
            ) : null}
          </>
        }
      />

      <TrAttachment
        formNo={15}
        result={result}
        hraArea={hraArea}
        info={info}
        preparedOn={preparedOn}
        payable={payable}
        payableWords={payableWords}
      />
    </div>
  );
}

export interface TrStaffEntry {
  id: string;
  name: string;
  post: string;
  nid: string;
  hraArea: HraArea;
  result: SalaryArrearResult;
}

const SCHEDULE_PAY_COLS: Array<[string, string]> = [
  ['মূল বেতন (কর্মচারী)', '৩১১১২০১'],
  ['ব্যক্তিগত বেতন', '৩১১১২০২'],
  ['শিক্ষা ভাতা', '৩১১১৩০৬'],
  ['পাহাড়ি ভাতা', '৩১১১৩০৭'],
  ['বাড়িভাড়া ভাতা', '৩১১১৩১০'],
  ['চিকিৎসা ভাতা', '৩১১১৩১১'],
  ['যাতায়াত ভাতা', '৩১১১৩০২'],
  ['টিফিন ভাতা', '৩১১১৩১৪'],
  ['ঝুঁকি ভাতা', '৩১১১৩০৮'],
  ['পোশাক ভাতা', '৩১১১৩১৫'],
  ['ধোলাই ভাতা', '৩১১১৩১৬'],
  ['বেতন ও ভাতার মোট দাবি (ক)', ''],
];

const SCHEDULE_DEDUCTION_COLS: Array<[string, string]> = [
  ['সাধারণ ভবিষ্য তহবিল (সিভিল)', '৮১১২২০১'],
  ['ভবিষ্য তহবিলের অগ্রিম ও সুদ আদায়', '৮১১২২০১'],
  ['কর্মচারী কল্যাণ তহবিল', '৮১৭২৫০৩'],
  ['ভাড়া - আবাসিক', '১৪২১৩০২'],
  ['স্ট্যাম্প ডিউটি', STAMP_DUTY_CODE],
  ['পানি ও পয়ঃনিষ্কাশন ব্যবস্থা চার্জ', '১৪২২৪০৪'],
  ['গৃহনির্মাণ ঋণ', '৭২১৫১০১'],
  ['মোটর সাইকেল ঋণ', '৭২১৫১০৫'],
  ['কম্পিউটার ঋণ', '৭২১৫১০২'],
  ['সরকারি কর্মচারীকে প্রদত্ত ঋণের সুদ', '১৪১১২০২'],
  ['স্থানীয় তহবিল জমা', '৮১১৩১১০'],
  ['মোট কর্তন ও আদায় (খ)', ''],
];

const SCHEDULE_COLS = 29;
/** Employee rows per Legal sheet; the header repeats on every sheet. */
const SCHEDULE_ROWS_PER_SHEET = 15;

/** Columns 1, 2, 3, 19, 26 and 27 of the establishment pay bill schedule (0-based indexes). */
function scheduleCells(serial: number, s: TrStaffEntry): React.ReactNode[] {
  const cells: React.ReactNode[] = Array.from({ length: SCHEDULE_COLS }, () => null);
  const net = s.result.total_net_arrear;
  cells[0] = toBanglaDigits(serial);
  cells[1] = (
    <>
      <div className="tr-staff-name">{s.name}</div>
      <div>{s.post}</div>
      {s.nid ? <div>এনআইডি: {toBanglaDigits(s.nid)}</div> : null}
    </>
  );
  cells[2] = taka(net);
  cells[18] = taka(STAMP_DUTY);
  cells[25] = taka(STAMP_DUTY);
  cells[26] = taka(net - STAMP_DUTY);
  return cells;
}

/** Establishment pay bill schedule (Legal, landscape): one row per employee, totals on the last sheet. */
function TrStaffSchedule({ staff, months, office }: { staff: TrStaffEntry[]; months: string[]; office: string }) {
  const period = periodText(months);
  const netTotal = staff.reduce((sum, s) => sum + s.result.total_net_arrear, 0);
  const stamp = STAMP_DUTY * staff.length;
  const payable = netTotal - stamp;
  const sheets: TrStaffEntry[][] = [];
  for (let i = 0; i < staff.length; i += SCHEDULE_ROWS_PER_SHEET) sheets.push(staff.slice(i, i + SCHEDULE_ROWS_PER_SHEET));

  return (
    <>
      {sheets.map((rows, sheetIndex) => {
        const last = sheetIndex === sheets.length - 1;
        const offset = sheetIndex * SCHEDULE_ROWS_PER_SHEET;
        return (
          <section key={sheetIndex} className="tr-page tr-legal-l tr-schedule">
            <div className="tr-schedule-title">সংস্থাপন কর্মচারীদের বেতন বিল</div>
            <div className="tr-schedule-sub">
              বকেয়া বেতন (বেতন স্কেল ২০২৬) — {period.month} {period.year}
              {sheets.length > 1 ? ` · পৃষ্ঠা ${toBanglaDigits(sheetIndex + 1)}/${toBanglaDigits(sheets.length)}` : ''}
            </div>
            <div className="tr-schedule-head">
              <span>
                অফিসের নাম <Dots value={office} width="120mm" />
              </span>
              <span>
                প্রাতিষ্ঠানিক/ অপারেশন কোড *{' '}
                <span className="tr-code-boxes">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} />
                  ))}
                </span>
              </span>
            </div>

            <table className="tr-grid tr-schedule-grid">
              <colgroup>
                <col style={{ width: '7mm' }} />
                <col style={{ width: '38mm' }} />
                <col style={{ width: '17mm' }} />
                {Array.from({ length: 23 }, (_, i) => (
                  <col key={i} />
                ))}
                <col style={{ width: '17mm' }} />
                <col style={{ width: '10mm' }} />
                <col style={{ width: '10mm' }} />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>পদের ক্রমিক নং</th>
                  <th rowSpan={2}>
                    সেরেস্তার শাখা ও পদসহ কর্মচারীদের নাম (এনআইডি নং, জি. পি. এফ নং ও ডাক জীবনবিমা নং)
                  </th>
                  <th colSpan={12} className="tr-schedule-group">
                    বেতন ও ভাতা
                  </th>
                  <th colSpan={12} className="tr-schedule-group">
                    কর্তন ও পরিশোধ
                  </th>
                  <th rowSpan={2}>
                    প্রদেয় বিল (ক-খ)
                    <div className="tr-schedule-code">৮১৭২১০৮</div>
                  </th>
                  <th rowSpan={2}>মন্তব্য</th>
                  <th rowSpan={2}>প্রাপ্তি রশিদ</th>
                </tr>
                <tr>
                  {[...SCHEDULE_PAY_COLS, ...SCHEDULE_DEDUCTION_COLS].map(([label, code], i) => (
                    <th key={i}>
                      {label}
                      {code ? <div className="tr-schedule-code">{code}</div> : null}
                    </th>
                  ))}
                </tr>
                <tr className="tr-schedule-nums">
                  {Array.from({ length: SCHEDULE_COLS }, (_, i) => (
                    <th key={i}>{toBanglaDigits(i + 1)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={s.id}>
                    {scheduleCells(offset + i + 1, s).map((cell, c) => (
                      <td key={c} className={c === 1 ? 'tr-schedule-name' : c === 0 ? 'tr-center' : 'tr-num'}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {last ? (
                  <tr className="tr-total">
                    <td colSpan={2}>মোট ({toBanglaDigits(staff.length)} জন)</td>
                    <td className="tr-num">{taka(netTotal)}</td>
                    {Array.from({ length: 15 }, (_, i) => (
                      <td key={`a${i}`} />
                    ))}
                    <td className="tr-num">{taka(stamp)}</td>
                    {Array.from({ length: 6 }, (_, i) => (
                      <td key={`b${i}`} />
                    ))}
                    <td className="tr-num">{taka(stamp)}</td>
                    <td className="tr-num">{taka(payable)}</td>
                    <td />
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>

            <p className="tr-schedule-foot">
              * প্রতিষ্ঠানের ক্ষেত্রে ০৬ ডিজিট এবং বিশেষ কার্যক্রম/ প্রজেক্ট/ স্কিম -এর ক্ষেত্রে সাত (০৭) ডিজিটের কোড ব্যবহার করতে হবে।
            </p>
          </section>
        );
      })}
    </>
  );
}

/** One T.R. Form 15 for all office staff: totals on the form, a staff summary sheet, then one attachment per employee. */
export const TrForm15Staff = forwardRef<
  HTMLDivElement,
  { staff: TrStaffEntry[]; months: string[]; office: string; preparedOn: string }
>(function TrForm15Staff({ staff, months, office, preparedOn }, ref) {
  const sum = (pick: (r: SalaryArrearResult) => number) => staff.reduce((total, s) => total + pick(s.result), 0);
  const netTotal = sum((r) => r.total_net_arrear);
  const stamp = STAMP_DUTY * staff.length;
  const payable = netTotal - stamp;
  const payableWords = takaInWords('bn', payable);

  return (
    <div ref={ref} className="salary-tr-form tr15 hidden" lang="bn">
      <TrForm15Pages
        months={months}
        office={office}
        netTotal={netTotal}
        stamp={stamp}
        payable={payable}
        payableWords={payableWords}
        headBox={
          <>
            <div>
              কর্মচারীর সংখ্যাঃ <Dots value={`${toBanglaDigits(staff.length)} জন`} width="16mm" />
            </div>
            <div>
              স্ট্যাম্প ডিউটিঃ <Dots value={`৳ ${taka(stamp)}`} width="20mm" />
            </div>
          </>
        }
      />

      <TrStaffSchedule staff={staff} months={months} office={office} />

      <section className="tr-page">
        <div className="tr-attach-kicker">সংযুক্তি — টি, আর, ফরম নং ১৫</div>
        <div className="tr-attach-title">অফিস স্টাফের বকেয়া বিলের সারসংক্ষেপ</div>
        <table className="tr-info">
          <tbody>
            {office ? (
              <tr>
                <td>দপ্তরের নাম</td>
                <td>{office}</td>
              </tr>
            ) : null}
            <tr>
              <td>বকেয়ার মাস</td>
              <td>{[...months].sort().map((m) => monthText('bn', m)).join(', ')}</td>
            </tr>
            <tr>
              <td>বিশেষ সুবিধা</td>
              <td>পরবর্তী ধাপের মূল বেতনের ১৫% (সকল কর্মচারী)</td>
            </tr>
          </tbody>
        </table>
        <table className="tr-grid tr-summary tr-staff-summary">
          <thead>
            <tr>
              <th>ক্রমিক</th>
              <th>নাম ও পদবি</th>
              <th>গ্রেড</th>
              <th>মূল বেতন (৩০-০৬-২০২৬)</th>
              <th>মোট বকেয়া</th>
              <th>মোট কর্তন</th>
              <th>নিট বকেয়া</th>
              <th>স্ট্যাম্প</th>
              <th>প্রদেয়</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s, i) => {
              const r = s.result;
              return (
                <tr key={s.id}>
                  <td className="tr-center">{toBanglaDigits(i + 1)}</td>
                  <td>
                    <div className="tr-staff-name">{s.name}</div>
                    <div className="tr-math-sub">
                      {s.post}
                      {s.nid ? ` · এনআইডি ${toBanglaDigits(s.nid)}` : ''}
                    </div>
                  </td>
                  <td className="tr-center">{toBanglaDigits(r.grade)}</td>
                  <td className="tr-num">{taka(r.old_pay)}</td>
                  <td className="tr-num">{taka(r.total_basic_difference + r.total_hra_protection)}</td>
                  <td className="tr-num">{taka(r.total_deduction)}</td>
                  <td className="tr-num">{taka(r.total_net_arrear)}</td>
                  <td className="tr-num">{taka(STAMP_DUTY)}</td>
                  <td className="tr-num">{taka(r.total_net_arrear - STAMP_DUTY)}</td>
                </tr>
              );
            })}
            <tr className="tr-total">
              <td colSpan={4}>মোট ({toBanglaDigits(staff.length)} জন)</td>
              <td className="tr-num">{taka(sum((r) => r.total_basic_difference + r.total_hra_protection))}</td>
              <td className="tr-num">{taka(sum((r) => r.total_deduction))}</td>
              <td className="tr-num">{taka(netTotal)}</td>
              <td className="tr-num">{taka(stamp)}</td>
              <td className="tr-num">{taka(payable)}</td>
            </tr>
          </tbody>
        </table>
        <p className="tr-attach-total">
          স্ট্যাম্প ডিউটি বাদে প্রদেয়: (৳ {taka(netTotal)} − ৳ {taka(STAMP_DUTY)} × {toBanglaDigits(staff.length)}) = ৳{' '}
          {taka(payable)}
        </p>
        <p className="tr-attach-words">টাকা (কথায়) : {payableWords}</p>
        <p className="tr-small">প্রস্তুতের তারিখ: {preparedOn}</p>
      </section>

      {staff.map((s) => {
        const each = s.result.total_net_arrear - STAMP_DUTY;
        return (
          <TrAttachment
            key={s.id}
            formNo={15}
            result={s.result}
            hraArea={s.hraArea}
            info={{ office, employee: s.name, designation: s.post, nid: s.nid }}
            preparedOn={preparedOn}
            payable={each}
            payableWords={takaInWords('bn', each)}
          />
        );
      })}
    </div>
  );
});
