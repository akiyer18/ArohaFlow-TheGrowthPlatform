/**
 * Bank statement parsing: detect file type and extract normalized transactions.
 * Handles CSV, Excel, PDF. Never crash; fallback to empty array.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const ACCEPTED_TYPES = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

const DATE_HEADERS = ['date', 'datum', 'transaction date', 'posting date', 'value date', 'booking date'];
const DESC_HEADERS = ['description', 'transaction', 'details', 'memo', 'narration', 'omschrijving', 'reference'];
const AMOUNT_HEADERS = ['amount', 'balance', 'bedrag', 'value'];
const DEBIT_HEADERS = ['debit', 'withdrawal', 'money out', 'out', 'af', 'expense', 'withdrawals'];
const CREDIT_HEADERS = ['credit', 'deposit', 'money in', 'in', 'bij', 'income', 'deposits'];
const MERCHANT_HEADERS = ['merchant', 'payee', 'counterparty', 'name', 'description'];

function normalizeHeader(h) {
  if (typeof h !== 'string') return '';
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

function findColumnIndex(headers, candidates) {
  for (const c of candidates) {
    const i = headers.findIndex((h) => normalizeHeader(h).includes(c) || c.includes(normalizeHeader(h)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).replace(/[^\d.-]/g, '').trim();
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function buildNormalized(row, dateIdx, descIdx, amountIdx, debitIdx, creditIdx, merchantIdx, headers) {
  const get = (i) => (i >= 0 && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '');
  const getNum = (i) => (i >= 0 && row[i] !== undefined && row[i] !== null ? parseAmount(row[i]) : null);

  let dateStr = dateIdx >= 0 ? parseDate(row[dateIdx]) : null;
  if (!dateStr && dateIdx >= 0) dateStr = parseDate(get(dateIdx));

  const desc = descIdx >= 0 ? get(descIdx) : row.filter((_, i) => i !== amountIdx && i !== debitIdx && i !== creditIdx).join(' ');
  const merchant = merchantIdx >= 0 ? get(merchantIdx) : '';

  let amount = null;
  let type = 'expense';

  if (debitIdx >= 0 && creditIdx >= 0) {
    const debit = getNum(debitIdx);
    const credit = getNum(creditIdx);
    if (debit != null && debit !== 0) {
      amount = Math.abs(debit);
      type = 'expense';
    } else if (credit != null && credit !== 0) {
      amount = Math.abs(credit);
      type = 'income';
    }
  } else if (amountIdx >= 0) {
    amount = getNum(amountIdx);
    if (amount != null) {
      if (amount < 0) {
        amount = Math.abs(amount);
        type = 'expense';
      } else {
        type = 'income';
      }
    }
  }

  if (amount == null || amount === 0) return null;
  if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);

  return {
    date: dateStr,
    description: desc || 'Unknown',
    amount: type === 'expense' ? -amount : amount,
    type,
    merchant: merchant || null,
    category: 'Uncategorized',
    sourceBank: null,
  };
}

export function detectFileType(file) {
  const t = file?.type?.toLowerCase();
  if (ACCEPTED_TYPES[t]) return ACCEPTED_TYPES[t];
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  if (name.endsWith('.pdf')) return 'pdf';
  return null;
}

export function parseCSV(file) {
  return new Promise((resolve) => {
    try {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete(results) {
          const rows = results.data || [];
          if (rows.length < 2) {
            resolve([]);
            return;
          }
          const headerRow = rows[0].map((c) => (c != null ? String(c) : ''));
          const dateIdx = findColumnIndex(headerRow, DATE_HEADERS);
          const descIdx = findColumnIndex(headerRow, DESC_HEADERS);
          const amountIdx = findColumnIndex(headerRow, AMOUNT_HEADERS);
          const debitIdx = findColumnIndex(headerRow, DEBIT_HEADERS);
          const creditIdx = findColumnIndex(headerRow, CREDIT_HEADERS);
          const merchantIdx = findColumnIndex(headerRow, MERCHANT_HEADERS);

          const needAmount = amountIdx >= 0 || (debitIdx >= 0 && creditIdx >= 0);
          if (dateIdx < 0 || !needAmount) {
            resolve([]);
            return;
          }

          const out = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!Array.isArray(row) || row.every((c) => c === '' || c == null)) continue;
            const norm = buildNormalized(row, dateIdx, descIdx, amountIdx, debitIdx, creditIdx, merchantIdx, headerRow);
            if (norm) out.push(norm);
          }
          resolve(out);
        },
        error() {
          resolve([]);
        },
      });
    } catch {
      resolve([]);
    }
  });
}

export function parseExcel(file) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array', raw: false });
          const firstSheet = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheet];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!rows || rows.length < 2) {
            resolve([]);
            return;
          }
          const headerRow = rows[0].map((c) => (c != null ? String(c) : ''));
          const dateIdx = findColumnIndex(headerRow, DATE_HEADERS);
          const descIdx = findColumnIndex(headerRow, DESC_HEADERS);
          const amountIdx = findColumnIndex(headerRow, AMOUNT_HEADERS);
          const debitIdx = findColumnIndex(headerRow, DEBIT_HEADERS);
          const creditIdx = findColumnIndex(headerRow, CREDIT_HEADERS);
          const merchantIdx = findColumnIndex(headerRow, MERCHANT_HEADERS);

          const needAmount = amountIdx >= 0 || (debitIdx >= 0 && creditIdx >= 0);
          if (dateIdx < 0 || !needAmount) {
            resolve([]);
            return;
          }

          const out = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            const norm = buildNormalized(row, dateIdx, descIdx, amountIdx, debitIdx, creditIdx, merchantIdx, headerRow);
            if (norm) out.push(norm);
          }
          resolve(out);
        } catch {
          resolve([]);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch {
      resolve([]);
    }
  });
}

const AMOUNT_IN_PARENS = /\(([\d,]+\.?\d{0,2})\)\s*$/;

function extractDateFromLine(line) {
  const s = line.trim();
  // YYYY-MM-DD
  const iso = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return parseDate(iso[1]);
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
  if (dmy) return parseDate(`${dmy[1]}/${dmy[2]}/${dmy[3]}`);
  // DD Mon YYYY
  const dmy2 = s.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})\b/i);
  if (dmy2) return parseDate(dmy2[0]);
  return null;
}

function normalizeAmountString(str) {
  let s = String(str).replace(/\s/g, '').trim();
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return s;
}

function extractAmountFromLine(line) {
  const s = line.trim();
  // Amount in parentheses = negative
  const paren = s.match(AMOUNT_IN_PARENS);
  if (paren) {
    const n = parseAmount(normalizeAmountString(paren[1]));
    if (n != null) return { amount: n, type: 'expense' };
  }
  // Last number on line
  const lastNum = s.match(/([-+]?\s*[\d,.]+)\s*$/);
  if (lastNum) {
    const n = parseAmount(normalizeAmountString(lastNum[1]));
    if (n != null && Math.abs(n) < 1e9) return { amount: n, type: n < 0 ? 'expense' : 'income' };
  }
  // Any amount with 2 decimals - take last occurrence (handles "text 50.00" or "50,00")
  const twoDec = s.match(/[\d.,]+[.,]\d{2}/g);
  if (twoDec && twoDec.length > 0) {
    const last = twoDec[twoDec.length - 1];
    const n = parseAmount(normalizeAmountString(last));
    if (n != null && n > 0 && n < 1e9) return { amount: n, type: 'expense' };
  }
  // Currency prefix
  const curr = s.match(/(?:EUR|USD|GBP|CHF)\s*([-+]?\s*[\d,.\s]+)/i);
  if (curr) {
    const n = parseAmount(normalizeAmountString(curr[1]));
    if (n != null) return { amount: Math.abs(n), type: n < 0 ? 'expense' : 'income' };
  }
  return null;
}

function parseCurrencyAmounts(text) {
  const s = String(text || '');
  const matches = [...s.matchAll(/[€$£]\s*([0-9][\d.,]*)/g)];
  return matches
    .map((m) => parseAmount(normalizeAmountString(m[1])))
    .filter((n) => n != null && !Number.isNaN(n) && n > 0 && n < 1e9);
}

function isDateStartLine(line) {
  const s = String(line || '').trim();
  // e.g. "Feb 1, 2026 ..." (Revolut)
  return /^[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}\b/.test(s) || extractDateFromLine(s) != null;
}

function stripDateAndAmountsForDescription(line) {
  let s = String(line || '').trim();
  // Remove the leading date token if present
  s = s.replace(/^[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}\s+/, '');
  s = s
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, '')
    .replace(/[€$£]\s*[0-9][\d.,]*/g, '')
    .replace(/\([\d,]+\.?\d{0,2}\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function parsePDFLinesAsTransactions(lines) {
  const out = [];
  const list = Array.isArray(lines) ? lines : [];
  for (let i = 0; i < list.length; i++) {
    const line = String(list[i] || '').trim();
    if (line.length < 5) continue;
    if (/^Date\s+Description/i.test(line)) continue;
    if (/^Account transactions/i.test(line)) continue;
    if (/^Pending\s+from/i.test(line)) continue;
    if (/^Reverted\s+from/i.test(line)) continue;
    if (/^--\s*\d+\s*of\s*\d+\s*--/i.test(line)) continue;
    if (/^EUR Statement/i.test(line)) continue;

    if (!isDateStartLine(line)) continue;
    const dateStr = extractDateFromLine(line);
    if (!dateStr) continue;

    // Build a small block: current line + up to next 3 lines until next date-start
    const block = [line];
    for (let j = i + 1; j < Math.min(list.length, i + 5); j++) {
      const next = String(list[j] || '').trim();
      if (!next) continue;
      if (isDateStartLine(next)) break;
      if (/^--\s*\d+\s*of\s*\d+\s*--/i.test(next)) break;
      block.push(next);
    }

    // Revolut-style lines often contain: "… €AMOUNT €BALANCE"
    const amounts = parseCurrencyAmounts(line);
    const firstAmount = amounts.length > 0 ? amounts[0] : null;

    let amountInfo = null;
    if (firstAmount != null) {
      // Determine income vs expense using block clues
      const hasFrom = block.some((b) => /^From:\s*/i.test(b));
      const hasTo = block.some((b) => /^To:\s*/i.test(b));
      const descRaw = stripDateAndAmountsForDescription(line);
      const isIncomeKeyword = /top-?up|salary|payroll|deposit|refund/i.test(descRaw);
      const type = hasFrom || isIncomeKeyword ? 'income' : 'expense';
      amountInfo = { amount: firstAmount, type };
    } else {
      // Generic fallback
      amountInfo = extractAmountFromLine(line);
    }
    if (!amountInfo) continue;

    const amount = Math.abs(amountInfo.amount);
    if (!amount || amount === 0) continue;

    let merchant = null;
    const toLine = block.find((b) => /^To:\s*/i.test(b));
    const fromLine = block.find((b) => /^From:\s*/i.test(b));
    if (toLine) merchant = toLine.replace(/^To:\s*/i, '').trim();
    else if (fromLine) merchant = fromLine.replace(/^From:\s*/i, '').trim();

    const desc = stripDateAndAmountsForDescription(line);

    out.push({
      date: dateStr,
      description: (desc || 'Transaction').slice(0, 220),
      amount: amountInfo.type === 'expense' ? -amount : amount,
      type: amountInfo.type,
      merchant: merchant ? merchant.slice(0, 220) : null,
      category: 'Uncategorized',
      sourceBank: null,
    });
  }
  return out;
}

export function parsePDF(file) {
  return new Promise((resolve) => {
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (typeof pdfjsLib.GlobalWorkerOptions?.workerSrc === 'undefined') {
          try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
              'pdfjs-dist/build/pdf.worker.min.mjs',
              import.meta.url
            ).toString();
          } catch (_) {}
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const allLines = [];
        let rawTextAll = '';

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const items = content.items || [];

          rawTextAll += items.map((it) => it.str).join(' ') + '\n';

          const withPos = items.map((it) => {
            const t = it.transform || [];
            const y = t[5] != null ? t[5] : 0;
            const x = t[4] != null ? t[4] : 0;
            return { str: it.str, x, y };
          });
          const tol = 5;
          const byLine = {};
          for (const it of withPos) {
            const lineKey = Math.round(it.y / tol) * tol;
            if (!byLine[lineKey]) byLine[lineKey] = [];
            byLine[lineKey].push(it);
          }
          const lineOrder = Object.keys(byLine).map(Number).sort((a, b) => b - a);
          for (const key of lineOrder) {
            const parts = byLine[key].sort((a, b) => a.x - b.x).map((p) => p.str);
            const line = parts.join(' ').trim();
            if (line) allLines.push(line);
          }
        }

        if (allLines.length < 3) {
          allLines.length = 0;
          rawTextAll.split(/\n+/).forEach((l) => {
            const t = l.trim();
            if (t.length > 2) allLines.push(t);
          });
        }

        const fullTextFallback = rawTextAll || allLines.join('\n');
        let out = [];

        // Strategy 1: table with columns (split by 2+ spaces or tab)
        const rows = allLines.map((line) => line.split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean));
        if (rows.length >= 2) {
          const headerRow = rows[0].length ? rows[0] : (rows[1] || []);
          const dateIdx = findColumnIndex(headerRow, DATE_HEADERS);
          const amountIdx = findColumnIndex(headerRow, AMOUNT_HEADERS);
          const debitIdx = findColumnIndex(headerRow, DEBIT_HEADERS);
          const creditIdx = findColumnIndex(headerRow, CREDIT_HEADERS);
          const descIdx = findColumnIndex(headerRow, DESC_HEADERS);
          const merchantIdx = findColumnIndex(headerRow, MERCHANT_HEADERS);
          const needAmount = amountIdx >= 0 || debitIdx >= 0 || creditIdx >= 0;

          if (needAmount) {
            const start = headerRow.some((h) => parseAmount(h) != null) ? 0 : 1;
            for (let i = start; i < rows.length; i++) {
              const row = rows[i];
              if (!Array.isArray(row) || row.length < 2) continue;
              const norm = buildNormalized(row, dateIdx, descIdx, amountIdx, debitIdx, creditIdx, merchantIdx, headerRow);
              if (norm) out.push(norm);
            }
          }
        }

        // Strategy 2: regex on each line (date + amount anywhere)
        if (out.length === 0) {
          out = parsePDFLinesAsTransactions(allLines);
        }

        // Strategy 3: full text split by newline and try again
        if (out.length === 0 && fullTextFallback) {
          const flatLines = fullTextFallback.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 4);
          out = parsePDFLinesAsTransactions(flatLines);
        }

        resolve(out);
      } catch (_) {
        resolve([]);
      }
    })();
  });
}

export async function parseStatementFile(file, sourceBank = null) {
  const type = detectFileType(file);
  if (!type) return { transactions: [], error: 'Unsupported file type. Use PDF, CSV, or Excel.' };

  let transactions = [];
  if (type === 'csv') transactions = await parseCSV(file);
  else if (type === 'xlsx') transactions = await parseExcel(file);
  else if (type === 'pdf') transactions = await parsePDF(file);

  if (!Array.isArray(transactions)) transactions = [];

  const { categorizeTransaction } = await import('./categories.js');
  const out = transactions.map((t) => ({
    ...t,
    category: t.type === 'income' ? 'Income' : categorizeTransaction(t.description, t.merchant || '', t.amount, t.type),
  })).filter((t) => t.date && t.amount != null);

  return { transactions: out, sourceBank: sourceBank || null };
}
