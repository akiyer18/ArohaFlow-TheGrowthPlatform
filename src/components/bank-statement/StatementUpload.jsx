import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { FileUp, Loader2 } from 'lucide-react';
import { Button } from '../ui';
import { parseStatementFile, detectFileType } from '../../utils/bankStatement/parseStatement';

const ACCEPT = '.pdf,.csv,.xlsx,.xls';
const MAX_MB = 15;

export default function StatementUpload({ onParsed, onError, saving }) {
  const [drag, setDrag] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      const type = detectFileType(file);
      if (!type) {
        onError?.('Unsupported file. Use PDF, CSV, or Excel.');
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        onError?.(`File too large (max ${MAX_MB}MB).`);
        return;
      }
      setParsing(true);
      onError?.('');
      try {
        const { transactions, error } = await parseStatementFile(file);
        if (error) {
          onError?.(error);
          return;
        }
        if (transactions.length === 0) {
          onError?.('No transactions found in this file. Check format (date, amount columns).');
          return;
        }
        onParsed?.(transactions, file.name);
      } catch (e) {
        onError?.(e.message || 'Failed to parse file.');
      } finally {
        setParsing(false);
      }
    },
    [onParsed, onError]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer?.files?.[0];
      handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDrag(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
  }, []);

  const onInputChange = useCallback(
    (e) => {
      const file = e.target?.files?.[0];
      handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        drag ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/15 bg-white/5'
      }`}
    >
      <input
        type="file"
        accept={ACCEPT}
        onChange={onInputChange}
        className="hidden"
        id="statement-file-input"
      />
      <FileUp className="mx-auto h-10 w-10 text-emerald-400/80" />
      <p className="mt-2 text-sm font-medium text-app-text-primary">
        Drop your bank statement here, or click to browse
      </p>
      <p className="mt-1 text-xs text-app-text-muted">PDF, CSV, or Excel. Max {MAX_MB}MB.</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-4"
        disabled={parsing || saving}
        onClick={() => document.getElementById('statement-file-input')?.click()}
      >
        {parsing || saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {parsing ? 'Parsing…' : 'Saving…'}
          </>
        ) : (
          'Choose file'
        )}
      </Button>
    </motion.div>
  );
}
