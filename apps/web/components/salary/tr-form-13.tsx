'use client';

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
  type FormRow,
} from '@/components/salary/tr-form-parts';

const PAY_ROWS: FormRow[] = [
  { code: '৩১১১১০১', label: 'মূল বেতন (অফিসার) (বেতনস্কেল ২০২৬ এর বকেয়া)' },
  { code: '৩১১১৩০৬', label: 'শিক্ষা ভাতা' },
  { code: '৩১১১৩১০', label: 'বাড়িভাড়া ভাতা' },
  { code: '৩১১১৩১১', label: 'চিকিৎসা ভাতা' },
  { code: '৩১১১৩১২', label: 'মোবাইল/সেলফোন ভাতা' },
  { code: '৩২৫৮১৪০', label: 'মোটরযান রক্ষণাবেক্ষণ ব্যয়' },
  { code: '৩১১১৩০১', label: 'দায়িত্ব ভাতা' },
  { code: '৩১১১৩৩১', label: 'আপ্যায়ন ভাতা' },
  { code: '৩১১১৩৩৩', label: 'গৃহ-সহায়তা ভাতা' },
  { code: '৩১১১৩৩৯', label: 'পাচক ভাতা' },
  { code: '৩১১১৩৪০', label: 'নিরাপত্তা ভাতা' },
  { code: '৩১১১৩৪১', label: 'বিচারিক ভাতা' },
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
  { code: '৭২১৫১০৪', label: 'মোটরগাড়ি ঋণ' },
  { code: '৭২১৫১০৩', label: 'সুদমুক্ত ঋণ' },
  { code: '৭২১৫১০৫', label: 'মোটর সাইকেল ঋণ' },
  { code: '৭২১৫১০২', label: 'কম্পিউটার ঋণ' },
  { code: '৮১১২২০১', label: 'সাধারণ ভবিষ্য তহবিল (সিভিল)' },
  { code: '৮১৭২৪০১', label: 'তিতাস গ্যাস বিল' },
  { code: '৮১৭২৪০২', label: 'বাখরাবাদ গ্যাস বিল' },
  { code: '৮১৭২৪০৩', label: 'জালালাবাদ গ্যাস বিল' },
  { code: '৮১৭২৪০৪', label: 'কর্ণফুলী গ্যাস বিল' },
  { code: '৮১৭২৫০৩', label: 'কর্মচারী কল্যাণ তহবিল' },
  { code: '৮১৭২৫০৪', label: 'কর্মচারী যৌথবিমা তহবিল' },
];

const INSTRUCTIONS = [
  'যে মাসের কাজের বিনিময়ে বেতন অর্জন করা হয়েছে মাসের শেষ কার্যদিবসের ৫ (পাঁচ) দিন পূর্বে হিসাবরক্ষণ অফিসে বিল পেশ করতে হবে।',
  'পেশকৃত প্রতিটি বিলের জন্য একটি করে টোকেন নাম্বার দেওয়া হবে। আপত্তিসহ ফেরত বিল গ্রহণের প্রাক্কালে উক্ত টোকেন নাম্বার বাতিল করতে হবে। এতদ্ব্যতীত চেক গ্রহণকালে স্ট্যাম্পসহ একটি লিখিত রসিদ (প্রযোজ্য ক্ষেত্রে) প্রদান করতে হবে।',
  'ব্যাংক অ্যাকাউন্টে টাকা প্রদানের জন্য ইচ্ছানুসারে বেতন বিলে নির্দেশ করা যাবে। এরূপ ক্ষেত্রে নিজ ব্যাংক অ্যাকাউন্টে ইএফটি-এর মাধ্যমে টাকা সংগ্রহের জন্য বেতন বিল পেশ করা যাবে। ইএফটি-এর মাধ্যমে বিল গ্রহণের জন্য ইএফটি ফরম পূরণ করে সংশ্লিষ্ট হিসাবরক্ষণ অফিসে প্রেরণ করতে হবে। ইএফটি-এর মাধ্যমে ব্যাংক অ্যাকাউন্টে সরাসরি টাকা প্রদান করা হবে।',
];

/** T.R. Form No. 13 (gazetted officer's pay bill, substantive grades 1–10) filled with the arrears totals, plus a summary attachment. */
export function TrForm13({
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
  const period = periodText(result.rows.map((r) => r.month));
  const payRows = PAY_ROWS.map((row, i) => (i === 0 ? { ...row, amount: result.total_net_arrear } : row));
  const deductionRows: FormRow[] = [
    ...DEDUCTION_ROWS.map((row) => (row.code === STAMP_DUTY_CODE ? { ...row, amount: STAMP_DUTY } : row)),
    { code: '', label: '' },
    { code: '', label: '' },
  ];
  const payable = result.total_net_arrear - STAMP_DUTY;
  const payableWords = takaInWords('bn', payable);

  return (
    <div className="salary-tr-form hidden" lang="bn">
      <section className="tr-page">
        <div className="tr-head">
          <div className="tr-head-ref">
            <div>টি, আর, ফরম নং ১৩</div>
            <div>[এস, আর, ১৩৯ (১) দ্রষ্টব্য]</div>
          </div>
          <div className="tr-head-main">
            <div className="tr-title">গেজেটেড সরকারি কর্মকর্তার বেতন বিল</div>
            <div className="tr-head-line">
              <Dots value={period.month} width="38mm" /> মাস <Dots value={period.year} width="28mm" />
              বৎসর
            </div>
            <div className="tr-head-line">
              দপ্তর <Dots value={info.office} width="70mm" />
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
            নামঃ <Dots value={info.employee} width="58mm" /> পদবিঃ <Dots value={info.designation} width="48mm" /> এনআইডি নংঃ{' '}
            <Dots value={info.nid ? toBanglaDigits(info.nid) : undefined} width="38mm" />
          </div>
          <div>
            ভবিষ্য তহবিল হিসাব নংঃ <Dots width="26mm" /> ডাক জীবনবিমা নংঃ <Dots width="30mm" /> টি আই এন/ই টি আই এনঃ{' '}
            <Dots width="34mm" />
          </div>
          <div>
            টোকেন নংঃ <Dots width="22mm" /> তারিখঃ <Dots width="28mm" /> ভাউচার নংঃ <Dots width="26mm" /> তারিখঃ{' '}
            <Dots width="30mm" />
          </div>
        </div>

        <table className="tr-grid">
          <colgroup>
            <col style={{ width: '7mm' }} />
            <col style={{ width: '22mm' }} />
            <col />
            <col style={{ width: '22mm' }} />
            <col style={{ width: '12mm' }} />
            <col style={{ width: '26mm' }} />
            <col style={{ width: '12mm' }} />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={2} rowSpan={2}>
                অর্থনৈতিক কোড
              </th>
              <th rowSpan={2}>বিবরণ</th>
              <th colSpan={2}>হার</th>
              <th colSpan={2}>টাকার অঙ্ক</th>
            </tr>
            <tr>
              <th>টাকা</th>
              <th>পয়সা</th>
              <th>টাকা</th>
              <th>পয়সা</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="tr-section">
                বেতন ও ভাতা
              </td>
            </tr>
            {payRows.map((row, i) => (
              <CodeRow key={`p${i}`} row={row} />
            ))}
            <TotalRow label="সর্বমোট বেতন ও ভাতা (ক)" amount={result.total_net_arrear} />
            <tr>
              <td colSpan={7} className="tr-section">
                কর্তন ও পরিশোধ
              </td>
            </tr>
            {deductionRows.map((row, i) => (
              <CodeRow key={`d${i}`} row={row} />
            ))}
            <TotalRow label="কর্তন ও পরিশোধ বাবদ মোট আদায় (খ)" amount={STAMP_DUTY} />
            <CodeRow row={{ code: '৮১৭২১০৮', label: 'প্রদেয় বিল (ক-খ)', amount: payable }} />
            <tr>
              <td colSpan={7} className="tr-words">
                টাকা (কথায়): <strong>{payableWords}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="tr-footnote">
          * প্রতিষ্ঠানের ক্ষেত্রে ০৬ ডিজিট এবং বিশেষ কার্যক্রম/ প্রজেক্ট/ স্কিম -এর ক্ষেত্রে সাত (০৭) ডিজিটের কোড ব্যবহার করতে হবে।
        </p>
      </section>

      <section className="tr-page">
        <div className="tr-page-no">২</div>
        <div className="tr-p2-row">
          বাহক/ ব্যাংক/ এজেন্টের নামঃ <Dots width="110mm" />
        </div>
        <div className="tr-p2-officer">
          <div>
            তারিখঃ <Dots width="34mm" />
          </div>
          <Signature title="কর্মকর্তার স্বাক্ষর" lines={['সিল']} />
          <div className="tr-stamp-wrap">
            <div className="tr-stamp">
              রাজস্ব
              <br />
              স্ট্যাম্প
            </div>
            <div className="tr-small">[অপর পৃষ্ঠা দ্রষ্টব্য]</div>
          </div>
        </div>

        <div className="tr-p2-heading">হিসাবরক্ষণ অফিসে ব্যবহারের জন্য</div>
        <div className="tr-p2-row">
          প্রদানের জন্য পাস করা হল, টাকা <Dots width="48mm" /> কথায় <Dots width="78mm" />
        </div>
        <div className="tr-p2-signs">
          <Signature title="অডিটর (স্বাক্ষর)" lines={['নাম ......................', 'তাং ......................', 'সিল']} />
          <Signature title="সুপার (স্বাক্ষর)" lines={['নাম ......................', 'তাং ......................', 'সিল']} />
          <Signature
            title="নিরীক্ষা ও হিসাবরক্ষণ অফিসার (স্বাক্ষর)"
            lines={['নাম ......................', 'তাং ......................', 'সিল ......................']}
          />
        </div>
        <div className="tr-p2-cheque">
          <span>
            চেক নং <Dots width="44mm" />
          </span>
          <span>
            তাং <Dots width="26mm" />
          </span>
        </div>
        <div className="tr-p2-payer">
          <Signature
            title="চেক প্রদানকারীর স্বাক্ষর"
            lines={['নাম ......................................', 'তাং ...................................', 'সিল']}
          />
        </div>

        <div className="tr-p2-heading">নির্দেশাবলি</div>
        <ol className="tr-instructions">
          {INSTRUCTIONS.map((text, i) => (
            <li key={i}>
              {toBanglaDigits(i + 1)}. {text}
            </li>
          ))}
        </ol>
        <p className="tr-note">
          নোট-১ : বাহকের নিকট প্রদত্ত টাকা, চেক অথবা বিলের জালিয়াতি বা আত্মসাৎ সংক্রান্ত কোনরূপ দায়-দায়িত্ব সরকার গ্রাহ্য করবে না।
        </p>
      </section>

      <TrAttachment
        formNo={13}
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
