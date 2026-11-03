// ponytail: minimal Indian-numbering words, no deps
const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsUnder100(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}

function wordsUnder1000(n: number): string {
  if (n < 100) return wordsUnder100(n);
  return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + wordsUnder100(n % 100) : "");
}

function toWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh  = Math.floor(n / 100_000);    n %= 100_000;
  const thou  = Math.floor(n / 1_000);      n %= 1_000;
  if (crore) parts.push(wordsUnder100(crore) + " Crore");
  if (lakh)  parts.push(wordsUnder100(lakh)  + " Lakh");
  if (thou)  parts.push(wordsUnder1000(thou) + " Thousand");
  if (n)     parts.push(wordsUnder1000(n));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  const neg = amount < 0;
  const abs = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(abs / 100);
  const paise  = abs % 100;
  const prefix = neg ? "Minus " : "";
  const rWords = toWords(rupees);
  if (paise === 0) return prefix + "Rupees " + rWords + " Only";
  return prefix + "Rupees " + rWords + " and " + wordsUnder100(paise) + " Paise Only";
}

// ponytail: inline self-check, run with `npx tsx src/lib/amount-in-words.ts`
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("amount-in-words.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };
  assert(amountInWords(0) === "Rupees Zero Only", amountInWords(0));
  assert(amountInWords(3757) === "Rupees Three Thousand Seven Hundred Fifty Seven Only", amountInWords(3757));
  assert(amountInWords(10000000) === "Rupees One Crore Only", amountInWords(10000000));
  assert(amountInWords(125000) === "Rupees One Lakh Twenty Five Thousand Only", amountInWords(125000));
  assert(amountInWords(1234.5) === "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only", amountInWords(1234.5));
  console.log("amount-in-words self-check OK");
}
