'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { universalParse, type UniversalParseResult } from '@/lib/actions/universalParser';
import type { UniversalParserType } from '@/lib/parsers/typePrompts';

interface UniversalParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (parsedResult: any) => void;
  defaultType?: UniversalParserType;
  companyHqId: string;
}

const PARSER_TYPES: Array<{ value: UniversalParserType; label: string; available: boolean }> = [
  { value: 'product_definition', label: 'Product Definition', available: true },
  { value: 'ecosystem_map', label: 'Ecosystem Map', available: false },
  { value: 'event_selection', label: 'Event Selection', available: false },
  { value: 'blog', label: 'Blog Content', available: false },
  { value: 'generic', label: 'Generic Extraction', available: false },
];

export default function UniversalParserModal({
  isOpen,
  onClose,
  onApply,
  defaultType = 'product_definition',
  companyHqId,
}: UniversalParserModalProps) {
  const [parserType, setParserType] = useState<UniversalParserType>(defaultType);
  const [rawText, setRawText] = useState('');
  const [humanContext, setHumanContext] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<UniversalParseResult | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rawText.trim()) {
      setParseResult({
        success: false,
        error: 'Please provide raw text to parse',
      });
      return;
    }

    setIsParsing(true);
    setParseResult(null);

    try {
      const result = await universalParse({
        raw: rawText,
        context: humanContext || undefined,
        type: parserType,
        companyHqId,
      });

      setParseResult(result);
    } catch (error) {
      setParseResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = () => {
    if (parseResult?.success && parseResult.parsed) {
      onApply(parseResult.parsed);
      handleClose();
    }
  };

  const handleClose = () => {
    setRawText('');
    setHumanContext('');
    setParseResult(null);
    onClose();
  };

  const handleReset = () => {
    setRawText('');
    setHumanContext('');
    setParseResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">AI Parser</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] px-6 py-6">
          <div className="space-y-6">
            {/* Parser Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Parser Type
              </label>
              <select
                value={parserType}
                onChange={(e) => {
                  setParserType(e.target.value as UniversalParserType);
                  setParseResult(null);
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={isParsing}
              >
                {PARSER_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                    disabled={!type.available}
                  >
                    {type.label} {!type.available && '(Coming Soon)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Raw Text Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Raw Text / Facts <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste raw text, JSON, or facts about the product/service here..."
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
                disabled={isParsing}
              />
              <p className="mt-1 text-xs text-gray-500">
                Paste any text containing product information - descriptions, features, pricing, etc.
              </p>
            </div>

            {/* Human Context Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Editor's Notes / Context (Optional)
              </label>
              <textarea
                value={humanContext}
                onChange={(e) => setHumanContext(e.target.value)}
                placeholder="Add any additional context or instructions for the parser..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
                disabled={isParsing}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Provide additional context to guide the parser's interpretation
              </p>
            </div>

            {/* Parse Button */}
            <div className="flex justify-end">
              <button
                onClick={handleParse}
                disabled={isParsing || !rawText.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Parse
                  </>
                )}
              </button>
            </div>

            {/* Parse Result Preview */}
            {parseResult && (
              <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
                {parseResult.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <h3 className="text-lg font-semibold">Parse Successful</h3>
                    </div>

                    {parseResult.explanation && (
                      <p className="text-sm text-gray-600">{parseResult.explanation}</p>
                    )}

                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <h4 className="mb-3 text-sm font-semibold text-gray-700">
                        Extracted Fields:
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {Object.entries(parseResult.parsed || {}).map(([key, value]) => (
                          <div key={key} className="flex items-start gap-3 text-sm">
                            <span className="font-medium text-gray-600 min-w-[140px] capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>
                            <span className="text-gray-900 flex-1">
                              {value === null || value === ''
                                ? <span className="text-gray-400 italic">(empty)</span>
                                : typeof value === 'object'
                                ? JSON.stringify(value, null, 2)
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <h3 className="text-lg font-semibold">Parse Failed</h3>
                      <p className="text-sm text-gray-600 mt-1">{parseResult.error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gray-50">
          <button
            onClick={handleReset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            disabled={isParsing}
          >
            Reset
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              disabled={isParsing}
            >
              Cancel
            </button>
            {parseResult?.success && (
              <button
                onClick={handleApply}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Apply to Form
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

