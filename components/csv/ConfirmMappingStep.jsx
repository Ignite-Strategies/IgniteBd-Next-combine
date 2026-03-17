'use client';

/**
 * Universal "Confirm your CSV mapping" step.
 * Renders: "Let's make sure your CSV maps correctly — please confirm."
 * Table: CSV column → Maps to (dropdown). Used by contact upload and target submission.
 */
export default function ConfirmMappingStep({
  mapping,
  setMapping,
  fieldLabels,
  title = "Let's make sure your CSV maps correctly — please confirm.",
  emptyMessage,
  noDataMessage,
  hasDataRows = true,
}) {
  const fieldOptions = Object.entries(fieldLabels || {}).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-4">
      {!hasDataRows && noDataMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {noDataMessage}
        </div>
      )}
      {emptyMessage && mapping.length === 0 ? (
        <p className="text-sm text-gray-600">{emptyMessage}</p>
      ) : (
        <>
          <p className="text-gray-600">{title}</p>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">CSV column</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Maps to</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((m, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-3 py-2 text-gray-800 font-medium">{m.csvHeader}</td>
                    <td className="px-3 py-2">
                      <select
                        value={m.field || ''}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setMapping((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], field: v, label: v ? (fieldLabels[v] || v) : '—' };
                            return next;
                          });
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-gray-800"
                      >
                        <option value="">— Don't import</option>
                        {fieldOptions.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
