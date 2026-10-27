import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { formatTaka, type HraArea, type SalaryArrearResult } from '@ibas/shared-types';
import { takaInWords } from '@/lib/amount-words';
import { toBanglaDigits } from '@/lib/bangla-format';
import { hraAreaText, monthRowLabel } from '@/lib/salary-i18n';
import { ApiError } from '@/lib/api';

export interface TrPrintInfo {
  employee: string;
  designation: string;
  office: string;
  nid: string;
}

const PAY_13 = [
  ['৩১১১১০১', 'মূল বেতন (অফিসার) (বেতনস্কেল ২০২৬ এর বকেয়া)'],
  ['৩১১১৩০৬', 'শিক্ষা ভাতা'],
  ['৩১১১৩১০', 'বাড়িভাড়া ভাতা'],
  ['৩১১১৩১১', 'চিকিৎসা ভাতা'],
  ['৩১১১৩১২', 'মোবাইল/সেলফোন ভাতা'],
  ['৩২৫৮১৪০', 'মোটরযান রক্ষণাবেক্ষণ ব্যয়'],
  ['৩১১১৩০১', 'দায়িত্ব ভাতা'],
  ['৩১১১৩৩১', 'আপ্যায়ন ভাতা'],
  ['৩১১১৩৩৩', 'গৃহ-সহায়তা ভাতা'],
  ['৩১১১৩৩৯', 'পাচক ভাতা'],
  ['৩১১১৩৪০', 'নিরাপত্তা ভাতা'],
  ['৩১১১৩৪১', 'বিচারিক ভাতা'],
] as const;

const PAY_15 = [
  ['৩১১১২০১', 'মূল বেতন (কর্মচারী) (বেতনস্কেল ২০২৬ এর বকেয়া)'],
  ['৩১১১৩০৬', 'শিক্ষা ভাতা'],
  ['৩১১১৩১০', 'বাড়িভাড়া ভাতা'],
  ['৩১১১৩১১', 'চিকিৎসা ভাতা'],
  ['৩১১১৩০২', 'যাতায়াত ভাতা'],
  ['৩১১১৩১৪', 'টিফিন ভাতা'],
  ['৩১১১৩০৮', 'ঝুঁকি ভাতা'],
  ['৩১১১৩১৫', 'পোশাক ভাতা'],
  ['৩১১১৩১৬', 'ধোলাই ভাতা'],
] as const;

const DEDUCTIONS = [
  ['১১১১১০২', 'ব্যক্তি কর্তৃক দেয় অগ্রিম আয়কর'],
  ['১১৬২১০১', 'স্ট্যাম্প ডিউটি'],
  ['১৪১১২০২', 'সরকারি কর্মচারীকে প্রদত্ত ঋণের সুদ'],
  ['১৪২২৪০৪', 'পানি ও পয়ঃনিষ্কাশন ব্যবস্থা চার্জ'],
  ['১৪৪১২০৪', 'পৌরকর'],
  ['৭২১৫১০১', 'গৃহনির্মাণ ঋণ'],
  ['৮১১২২০১', 'সাধারণ ভবিষ্য তহবিল (সিভিল)'],
  ['৮১৭২৫০৩', 'কর্মচারী কল্যাণ তহবিল'],
  ['৮১৭২৫০৪', 'কর্মচারী যৌথবিমা তহবিল'],
] as const;

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function taka(n: number): string {
  const text = toBanglaDigits(formatTaka(Math.abs(n)));
  return n < 0 ? `− ${text}` : text;
}

function row(code: string, label: string, amount?: number): string {
  const shown = amount != null && amount !== 0 ? taka(amount) : '';
  return `<tr><td class="code">${code}</td><td>${label}</td><td class="amt">${shown}</td><td></td></tr>`;
}

function buildHtml(params: {
  formNo: 13 | 15;
  result: SalaryArrearResult;
  hraArea: HraArea;
  stamp: number;
  info: TrPrintInfo;
  fontBase64: string;
}): string {
  const { formNo, result, stamp, info, fontBase64 } = params;
  const payable = result.total_net_arrear - stamp;
  const words = takaInWords('bn', payable);
  const pay = formNo === 13 ? PAY_13 : PAY_15;
  const payRows = pay
    .map(([code, label], index) => row(code, label, index === 0 ? result.total_net_arrear : undefined))
    .join('');
  const dedRows = DEDUCTIONS.map(([code, label]) => row(code, label, code === '১১৬২১০১' ? stamp : undefined)).join('');
  const months = result.rows
    .map(
      (item) =>
        `<tr><td>${esc(monthRowLabel('bn', item))}</td><td class="amt">${taka(item.new_basic)}</td><td class="amt">${taka(item.drawn_basic)}</td><td class="amt">${taka(item.net_arrear)}</td></tr>`,
    )
    .join('');
  const title = formNo === 13 ? 'গেজেটেড সরকারি কর্মকর্তার বেতন বিল' : 'সরকারি কর্মচারীদের বেতন বিল';
  return `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8" />
<style>
  @font-face { font-family: Kalpurush; src: url(data:font/ttf;base64,${fontBase64}) format('truetype'); }
  body { font-family: Kalpurush, sans-serif; color: #111; font-size: 12px; }
  h1 { font-size: 16px; text-align: center; margin: 0; }
  .ref { text-align: right; font-size: 11px; }
  .line { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #222; padding: 3px 5px; vertical-align: top; }
  th { background: #f3f4f6; }
  .code { width: 22mm; font-weight: 700; }
  .amt { text-align: right; white-space: nowrap; font-weight: 700; }
  .section { background: #eef2ff; font-weight: 800; }
  .total { background: #e0e7ff; font-weight: 800; }
  .page { page-break-after: always; }
  .sign { margin-top: 28px; text-align: right; }
</style></head><body>
<section class="page">
  <div class="ref">টি, আর, ফরম নং ${toBanglaDigits(formNo)}<br/>[এস, আর, ${formNo === 13 ? '১৩৯ (১)' : '১৫২'} দ্রষ্টব্য]</div>
  <h1>${title}</h1>
  <div class="line">দপ্তর: <strong>${esc(info.office || '........................')}</strong></div>
  <div class="line">নাম: <strong>${esc(info.employee)}</strong> &nbsp; পদবি: <strong>${esc(info.designation || '........................')}</strong> &nbsp; এনআইডি: <strong>${esc(info.nid ? toBanglaDigits(info.nid) : '........................')}</strong></div>
  <table>
    <thead><tr><th>অর্থনৈতিক কোড</th><th>বিবরণ</th><th>টাকা</th><th>পয়সা</th></tr></thead>
    <tbody>
      <tr><td colspan="4" class="section">বেতন ও ভাতা</td></tr>
      ${payRows}
      <tr class="total"><td colspan="2">সর্বমোট বেতন ও ভাতা (ক)</td><td class="amt">${taka(result.total_net_arrear)}</td><td></td></tr>
      <tr><td colspan="4" class="section">কর্তন ও পরিশোধ</td></tr>
      ${dedRows}
      <tr class="total"><td colspan="2">কর্তন ও পরিশোধ বাবদ মোট আদায় (খ)</td><td class="amt">${taka(stamp)}</td><td></td></tr>
      ${row('৮১৭২১০৮', 'প্রদেয় বিল (ক-খ)', payable)}
      <tr><td colspan="4">টাকা (কথায়): <strong>${esc(words)}</strong></td></tr>
    </tbody>
  </table>
  <div class="sign">কর্মকর্তার স্বাক্ষর<br/>${esc(info.employee)}<br/>${esc(info.designation)}</div>
</section>
<section>
  <h1>সংযুক্তি — টি, আর, ফরম নং ${toBanglaDigits(formNo)}</h1>
  <div class="line">বাড়ি ভাড়া: ${esc(hraAreaText('bn', params.hraArea))}</div>
  <table>
    <thead><tr><th>মাস</th><th>নির্ধারিত মূল</th><th>উত্তোলিত মূল</th><th>নিট বকেয়া</th></tr></thead>
    <tbody>
      ${months}
      <tr class="total"><td colspan="3">মোট নিট বকেয়া</td><td class="amt">${taka(result.total_net_arrear)}</td></tr>
      <tr><td colspan="3">স্ট্যাম্প ডিউটি</td><td class="amt">${taka(stamp)}</td></tr>
      <tr class="total"><td colspan="3">প্রদেয়</td><td class="amt">${taka(payable)}</td></tr>
    </tbody>
  </table>
  <div class="line">কথায়: ${esc(words)}</div>
  <div class="sign">${esc(info.employee)}<br/>${esc(info.designation)}<br/>${esc(info.office)}</div>
</section>
</body></html>`;
}

let cachedFont: string | null = null;

async function fontBase64(): Promise<string> {
  if (cachedFont) return cachedFont;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/fonts/Kalpurush.ttf') as number);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new ApiError('Could not load the Bangla font');
  cachedFont = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return cachedFont;
}

export async function shareSalaryTrForm(params: {
  formNo: 13 | 15;
  result: SalaryArrearResult;
  hraArea: HraArea;
  stamp: number;
  info: TrPrintInfo;
}): Promise<void> {
  const html = buildHtml({ ...params, fontBase64: await fontBase64() });
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const filename = `TR-Form-${params.formNo}-${params.info.employee.replace(/[^\w.\-]+/g, '_').slice(0, 24) || 'arrears'}.pdf`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new ApiError('Storage is not available on this device');
  const dest = `${dir}${filename}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
  } catch {
    // Keep the print URI when the copy fails.
  }
  const shareUri = (await FileSystem.getInfoAsync(dest)).exists ? dest : uri;
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError(Platform.OS === 'web' ? 'Sharing is not available in this browser' : 'Sharing is not available on this device');
  }
  await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', dialogTitle: `T.R. Form ${params.formNo}`, UTI: 'com.adobe.pdf' });
}
