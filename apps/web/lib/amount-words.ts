const EN_ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** Bangla number words differ for every value below 100, so they are listed in full. */
const BN_0_99 = [
  'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়',
  'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ',
  'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ',
  'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ',
  'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ',
  'পঞ্চাশ', 'একান্ন', 'বাহান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট',
  'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর',
  'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি',
  'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই',
  'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই',
];

function enBelow100(n: number): string {
  if (n < 20) return EN_ONES[n]!;
  const ones = n % 10;
  return ones ? `${EN_TENS[Math.floor(n / 10)]}-${EN_ONES[ones]}` : EN_TENS[Math.floor(n / 10)]!;
}

function enBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${EN_ONES[hundreds]} Hundred`);
  if (rest) parts.push(enBelow100(rest));
  return parts.join(' ');
}

function bnBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${BN_0_99[hundreds]}শত`);
  if (rest) parts.push(BN_0_99[rest]!);
  return parts.join(' ');
}

/** Crore / lakh / thousand grouping, as used in Bangladesh. */
function groupWords(n: number, below1000: (v: number) => string, units: [string, string, string]): string {
  if (n === 0) return '';
  const [crore, lakh, thousand] = units;
  const parts: string[] = [];
  const crores = Math.floor(n / 10_000_000);
  const lakhs = Math.floor((n % 10_000_000) / 100_000);
  const thousands = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crores) parts.push(`${groupWords(crores, below1000, units)} ${crore}`);
  if (lakhs) parts.push(`${below1000(lakhs)} ${lakh}`);
  if (thousands) parts.push(`${below1000(thousands)} ${thousand}`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** Amount in words with paisa, e.g. "Fifteen Thousand One Hundred Two Taka and Fifty Paisa Only" / "পনেরো হাজার একশত দুই টাকা পঞ্চাশ পয়সা মাত্র". */
export function takaInWords(locale: 'en' | 'bn', amount: number): string {
  const totalPaisa = Math.round(Math.abs(amount) * 100);
  const n = Math.floor(totalPaisa / 100);
  const paisa = totalPaisa % 100;
  const negative = amount < 0 && totalPaisa > 0;
  if (locale === 'bn') {
    const words = n === 0 ? BN_0_99[0] : groupWords(n, bnBelow1000, ['কোটি', 'লক্ষ', 'হাজার']);
    const paisaText = paisa ? ` ${BN_0_99[paisa]} পয়সা` : '';
    return `${negative ? 'ঋণাত্মক ' : ''}${words} টাকা${paisaText} মাত্র`;
  }
  const words = n === 0 ? EN_ONES[0] : groupWords(n, enBelow1000, ['Crore', 'Lakh', 'Thousand']);
  const paisaText = paisa ? ` and ${enBelow100(paisa)} Paisa` : '';
  return `${negative ? 'Minus ' : ''}${words} Taka${paisaText} Only`;
}
