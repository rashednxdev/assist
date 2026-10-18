'use client';

import { formatTaka, type HraArea, type SalaryArrearResult } from '@ibas/shared-types';
import { toBanglaDigits } from '@/lib/bangla-format';
import { hraAreaText, monthRowLabel, monthText, salaryCopy } from '@/lib/salary-i18n';
import type { SalaryPrintInfo } from '@/components/salary/salary-print-dialog';
import {
  MonthMath,
  daysNote,
  groupMonths,
  isoToDmy,
  oneTimeDeductions,
  type Fmt,
} from '@/components/salary/salary-arrears-bill';

export interface FormRow {
  code: string;
  label: string;
  amount?: number;
}

export const STAMP_DUTY_CODE = '১১৬২১০১';
export const STAMP_DUTY = 10;

export function taka(n: number): string {
  const text = toBanglaDigits(formatTaka(Math.abs(n)));
  return n < 0 ? `− ${text}` : text;
}

export function periodText(keys: string[]): { month: string; year: string } {
  const names = salaryCopy('bn').months;
  const sorted = [...keys].sort();
  const parse = (k: string) => ({ y: Number(k.slice(0, 4)), m: Number(k.slice(5, 7)) });
  const first = parse(sorted[0]!);
  const last = parse(sorted[sorted.length - 1]!);
  const name = (p: { m: number }) => names[p.m - 1]!;
  if (first.y === last.y) {
    return {
      month: sorted.length === 1 ? name(first) : `${name(first)} – ${name(last)}`,
      year: toBanglaDigits(first.y),
    };
  }
  return {
    month: `${name(first)} ${toBanglaDigits(first.y)} – ${name(last)} ${toBanglaDigits(last.y)}`,
    year: `${toBanglaDigits(first.y)}-${toBanglaDigits(last.y)}`,
  };
}

export function Dots({ value, width, className }: { value?: string; width: string; className?: string }) {
  return (
    <span className={className ? `tr-dots ${className}` : 'tr-dots'} style={{ minWidth: width }}>
      {value || '\u00a0'}
    </span>
  );
}

function takaPaisa(amount: number): { taka: string; paisa: string } {
  const totalPaisa = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(totalPaisa / 100);
  const text = toBanglaDigits(new Intl.NumberFormat('en-BD').format(whole));
  return {
    taka: amount < 0 ? `− ${text}` : text,
    paisa: toBanglaDigits(String(totalPaisa % 100).padStart(2, '0')),
  };
}

/** Taka and paisa cells, optionally preceded by the two empty rate cells of T.R. Form 13. */
export function AmountCells({ amount, rate = true }: { amount?: number; rate?: boolean }) {
  const parts = amount !== undefined ? takaPaisa(amount) : null;
  return (
    <>
      {rate ? (
        <>
          <td />
          <td />
        </>
      ) : null}
      <td className="tr-num">{parts?.taka ?? ''}</td>
      <td className="tr-num">{parts?.paisa ?? ''}</td>
    </>
  );
}

export function CodeRow({ row, rate = true }: { row: FormRow; rate?: boolean }) {
  return (
    <tr>
      <td className="tr-box-cell">
        <span className="tr-box">{row.amount !== undefined ? '✓' : ''}</span>
      </td>
      <td className="tr-code">{row.code}</td>
      <td>{row.label}</td>
      <AmountCells amount={row.amount} rate={rate} />
    </tr>
  );
}

export function TotalRow({ label, amount, rate = true }: { label: string; amount: number; rate?: boolean }) {
  return (
    <tr className="tr-total">
      <td colSpan={3} className="tr-right">
        {label}
      </td>
      <AmountCells amount={amount} rate={rate} />
    </tr>
  );
}

export function Signature({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="tr-sign">
      <div className="tr-sign-line">{title}</div>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

/** Who signs the attachment and summary sheet; blank parts are left out. */
export interface TrSignatory {
  name: string;
  post: string;
  office: string;
}

/** Signature line with the signer's name, post and office below it, at the foot of a sheet. */
export function SignatureBlock({ signatory }: { signatory: TrSignatory }) {
  return (
    <div className="tr-attest">
      <div className="tr-attest-box">
        <div className="tr-attest-line" />
        {signatory.name ? <div className="tr-attest-name">({signatory.name})</div> : null}
        {signatory.post ? <div>{signatory.post}</div> : null}
        {signatory.office ? <div>{signatory.office}</div> : null}
      </div>
    </div>
  );
}

/**
 * Sheet content the PDF export may enlarge to fill the page; the section needs `tr-autofit`.
 * Keep `AttachFooter` outside it so the footer stays pinned and unscaled.
 */
export function FitBody({ children }: { children: React.ReactNode }) {
  return <div className="tr-fit-body">{children}</div>;
}

/**
 * Bottom-left lines of an annexure sheet, the only footer in the T.R. PDFs; the sheet needs `tr-attach-page`
 * to pin it to the page bottom. The PDF export keeps its link clickable.
 */
export function AttachFooter({ preparedOn }: { preparedOn: string }) {
  return (
    <div className="tr-attach-footer">
      <div className="tr-calc-by">
        Developed by: <a href="https://www.proassistbd.com">www.proassistbd.com</a>
      </div>
      <div>প্রস্তুতের তারিখ ও সময়: {preparedOn}</div>
    </div>
  );
}

/** Summary page attached after the T.R. form: employee details, month-wise working and totals. */
export function TrAttachment({
  formNo,
  result,
  hraArea,
  info,
  preparedOn,
  payable,
  payableWords,
  signatory,
}: {
  formNo: 13 | 15;
  result: SalaryArrearResult;
  hraArea: HraArea;
  info: SalaryPrintInfo;
  preparedOn: string;
  payable: number;
  payableWords: string;
  signatory: TrSignatory | null;
}) {
  const t = salaryCopy('bn');
  const fmt: Fmt = {
    t,
    locale: 'bn',
    num: (v) => toBanglaDigits(v),
    amt: (n) => toBanglaDigits(formatTaka(n)),
    signed: taka,
  };
  const oneTime = oneTimeDeductions(t, fmt.amt, result);
  return (
    <section className="tr-page tr-attach-page tr-autofit">
      <FitBody>
      <div className="tr-attach-kicker">সংযুক্তি — টি, আর, ফরম নং {toBanglaDigits(formNo)}</div>
      <div className="tr-attach-title">{t.billTitle}</div>
      <table className="tr-info">
        <tbody>
          {info.employee ? (
            <tr>
              <td>{t.employeeName}</td>
              <td className="tr-name">{info.employee}</td>
            </tr>
          ) : null}
          {info.designation ? (
            <tr>
              <td>{t.designation}</td>
              <td>{info.designation}</td>
            </tr>
          ) : null}
          {info.nid ? (
            <tr>
              <td>{t.nid}</td>
              <td>{toBanglaDigits(info.nid)}</td>
            </tr>
          ) : null}
          {info.office ? (
            <tr>
              <td>{t.officeName}</td>
              <td>{info.office}</td>
            </tr>
          ) : null}
          <tr>
            <td>{t.basisGrade}</td>
            <td>
              {toBanglaDigits(result.grade)}
              {result.bill_grade !== result.grade
                ? ` → ${toBanglaDigits(result.bill_grade)} (${t.basisBillGrade})`
                : ''}
            </td>
          </tr>
          {result.substantive_grade !== result.grade ? (
            <tr>
              <td>{t.basisSubstantive}</td>
              <td>{toBanglaDigits(result.substantive_grade)}</td>
            </tr>
          ) : null}
          {result.increment_withheld ? (
            <tr>
              <td>{t.basisIncrement}</td>
              <td>{result.increment_exempt ? t.basisNoIncrementExempt : t.basisNoIncrement}</td>
            </tr>
          ) : null}
          {result.pay_change ? (
            <>
              <tr>
                <td>{t.basisPayChange}</td>
                <td>
                  {toBanglaDigits(isoToDmy(result.pay_change.effective_date))} · {t.grade}{' '}
                  {toBanglaDigits(result.pay_change.grade)} · {t.lineDrawn} ৳ {taka(result.pay_change.old_pay)}
                </td>
              </tr>
              {result.pay_change_origin_fixed_2026 != null ? (
                <tr>
                  <td>{t.basisPayChangeOriginFixed}</td>
                  <td>৳ {taka(result.pay_change_origin_fixed_2026)}</td>
                </tr>
              ) : null}
              {result.pay_change_matched_basic != null ? (
                <tr>
                  <td>{t.basisPayChangeMatched}</td>
                  <td>৳ {taka(result.pay_change_matched_basic)}</td>
                </tr>
              ) : null}
              {result.pay_change_scale_diff != null ? (
                <tr>
                  <td>{t.basisPayChangeScaleDiff}</td>
                  <td>৳ {taka(result.pay_change_scale_diff)}</td>
                </tr>
              ) : null}
            </>
          ) : null}
          {result.hra_eligible ? (
            <tr>
              <td>{t.basisHraEntitlement}</td>
              <td>৳ {taka(result.hra_entitlement_30_06)}</td>
            </tr>
          ) : null}
          {result.arrear_from_date ? (
            <tr>
              <td>{result.increment_withheld && !result.increment_exempt ? t.basisJoining : t.basisArrearStart}</td>
              <td>{toBanglaDigits(isoToDmy(result.arrear_from_date))}</td>
            </tr>
          ) : null}
          <tr>
            <td>{t.basisDrawn}</td>
            <td>৳ {taka(result.next_step)}</td>
          </tr>
          <tr>
            <td>{t.basisSpecial}</td>
            <td>
              {toBanglaDigits(result.special_rate_percent)}% (
              {result.special_rate_fixed ? t.arrBandStaff : result.substantive_grade >= 10 ? t.arrBandHigh : t.arrBandLow})
            </td>
          </tr>
          <tr>
            <td>{t.basisHousing}</td>
            <td>{result.hra_eligible ? hraAreaText('bn', hraArea) : t.govtHousing}</td>
          </tr>
          {result.hra_protection > 0 ? (
            <tr>
              <td>{t.basisHraProtection}</td>
              <td>৳ {taka(result.hra_protection)}</td>
            </tr>
          ) : null}
          <tr>
            <td>{t.basisMonths}</td>
            <td>{result.rows.map((r) => monthText('bn', r.month)).join(', ')}</td>
          </tr>
          {oneTime.length > 0 ? (
            <tr>
              <td>{t.arrExtraHead}</td>
              <td>
                {oneTime.map((d) => (
                  <div key={d.key}>
                    {d.label} ({t.arrOneTime}): {d.rule}
                  </div>
                ))}
                <div className="tr-small">
                  {t.arrIncrementCalc(fmt.amt(result.next_step), fmt.amt(result.old_pay), fmt.amt(result.increment))}
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="tr-attach-head">{t.billMonthsHead}</div>
      <div className="tr-month-blocks">
        {groupMonths(result.rows).map((group) => (
          <MonthMath key={group.lead.month} f={fmt} result={result} group={group} />
        ))}
      </div>

      <div className="tr-attach-head">{t.billSummary}</div>
      <table className="tr-grid tr-summary">
        <thead>
          <tr>
            <th>{t.arrColMonth}</th>
            <th>{t.arrColNewBasic}</th>
            <th>{t.arrColDrawn}</th>
            <th>{t.arrColDiff}</th>
            <th>{t.arrColSpecial}</th>
            <th>{result.hra_protection > 0 ? t.arrColHraProtection : t.arrColHra}</th>
            <th>{t.arrColNet}</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, idx) => (
            <tr key={`${row.month}-${row.day_from ?? 'f'}-${idx}`}>
              <td>
                {monthRowLabel('bn', row)}
                {daysNote(t, toBanglaDigits, row)}
              </td>
              <td className="tr-num">{taka(row.new_basic)}</td>
              <td className="tr-num">{taka(row.drawn_basic)}</td>
              <td className="tr-num">{taka(row.basic_difference)}</td>
              <td className="tr-num">{taka(row.special_allowance)}</td>
              <td className="tr-num">
                {row.hra_protection > 0 ? `+ ${taka(row.hra_protection)}` : taka(row.excess_hra)}
              </td>
              <td className="tr-num">{taka(row.net_arrear)}</td>
            </tr>
          ))}
          {oneTime.map((d) => (
            <tr key={d.key}>
              <td colSpan={6}>
                {d.label} ({t.arrOneTime}) — {d.rule}
              </td>
              <td className="tr-num">− {taka(d.amount)}</td>
            </tr>
          ))}
          <tr className="tr-total">
            <td colSpan={3}>{t.arrTotalRow(toBanglaDigits(result.rows.length), result.rows.length === 1)}</td>
            <td className="tr-num">{taka(result.total_basic_difference)}</td>
            <td className="tr-num">{taka(result.total_special_allowance)}</td>
            <td className="tr-num">
              {result.total_hra_protection > 0 ? `+ ${taka(result.total_hra_protection)}` : taka(result.total_excess_hra)}
            </td>
            <td className="tr-num">{taka(result.total_net_arrear)}</td>
          </tr>
        </tbody>
      </table>

      <div className="tr-attach-head">{t.arrMathTitle}</div>
      <table className="tr-math">
        <tbody>
          <tr>
            <td>
              {t.arrMathTotal}
              {result.total_hra_protection > 0 ? (
                <span className="tr-math-sub">
                  {t.arrColDiff} ৳ {taka(result.total_basic_difference)} + {t.arrColHraProtection} ৳{' '}
                  {taka(result.total_hra_protection)}
                </span>
              ) : null}
            </td>
            <td className="tr-num">৳ {taka(result.total_basic_difference + result.total_hra_protection)}</td>
          </tr>
          <tr>
            <td>
              {t.arrMathDeductions}
              <span className="tr-math-sub">
                {t.arrColSpecial} ৳ {taka(result.total_special_allowance)} + {t.arrColHra} ৳ {taka(result.total_excess_hra)}
                {oneTime.map((d) => ` + ${d.label} ৳ ${taka(d.amount)}`).join('')}
              </span>
            </td>
            <td className="tr-num">− ৳ {taka(result.total_deduction)}</td>
          </tr>
          <tr className="tr-math-net">
            <td>{t.arrMathNet}</td>
            <td className="tr-num">৳ {taka(result.total_net_arrear)}</td>
          </tr>
        </tbody>
      </table>
      <p className="tr-attach-total">
        স্ট্যাম্প ডিউটি বাদে প্রদেয়: (৳ {taka(result.total_net_arrear)} − ৳ {taka(STAMP_DUTY)}) = ৳ {taka(payable)}
      </p>
      <p className="tr-attach-words">{t.inWords(payableWords)}</p>
      {signatory ? <SignatureBlock signatory={signatory} /> : null}
      </FitBody>
      <AttachFooter preparedOn={preparedOn} />
    </section>
  );
}
