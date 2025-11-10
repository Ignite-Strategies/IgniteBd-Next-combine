'use client';

import { PRODUCT_CONFIG, getFieldsByGroup } from '@/lib/config/productConfig';

/**
 * Render form fields based on product config
 */
export function ProductFormFields({ register, errors, isBusy, personas = [] }) {
  const renderField = (fieldName) => {
    const config = PRODUCT_CONFIG.fields[fieldName];
    if (!config) return null;

    const commonProps = {
      disabled: isBusy,
      className: 'w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
      ...register(fieldName, {
        required: config.required ? `${config.label} is required` : false,
      }),
    };

    // Handle different field types
    switch (config.type) {
      case 'textarea':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {config.label} {config.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              {...commonProps}
              rows={config.rows || 3}
              placeholder={config.placeholder}
            />
            {errors[fieldName] && (
              <p className="text-xs text-red-500">{errors[fieldName].message}</p>
            )}
            {config.helpText && (
              <p className="text-xs text-gray-500">{config.helpText}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {config.label} {config.required && <span className="text-red-500">*</span>}
            </label>
            <select {...commonProps}>
              <option value="">{config.placeholder || 'Select...'}</option>
              {config.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors[fieldName] && (
              <p className="text-xs text-red-500">{errors[fieldName].message}</p>
            )}
            {config.helpText && (
              <p className="text-xs text-gray-500">{config.helpText}</p>
            )}
          </div>
        );

      case 'persona-select':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {config.label} {config.required && <span className="text-red-500">*</span>}
            </label>
            <select {...commonProps}>
              <option value="">Select a persona (optional)</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name || 'Unnamed Persona'}
                </option>
              ))}
            </select>
            {errors[fieldName] && (
              <p className="text-xs text-red-500">{errors[fieldName].message}</p>
            )}
            {config.helpText && (
              <p className="text-xs text-gray-500">{config.helpText}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {config.label} {config.required && <span className="text-red-500">*</span>}
            </label>
            <input
              {...commonProps}
              type="number"
              step={config.step || 1}
              min={config.min || 0}
              placeholder={config.placeholder}
            />
            {errors[fieldName] && (
              <p className="text-xs text-red-500">{errors[fieldName].message}</p>
            )}
            {config.helpText && (
              <p className="text-xs text-gray-500">{config.helpText}</p>
            )}
          </div>
        );

      default: // string, text input
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {config.label} {config.required && <span className="text-red-500">*</span>}
            </label>
            <input
              {...commonProps}
              type="text"
              placeholder={config.placeholder}
              maxLength={config.maxLength}
            />
            {errors[fieldName] && (
              <p className="text-xs text-red-500">{errors[fieldName].message}</p>
            )}
            {config.helpText && (
              <p className="text-xs text-gray-500">{config.helpText}</p>
            )}
          </div>
        );
    }
  };

  // Render fields by group
  return (
    <div className="space-y-8">
      {PRODUCT_CONFIG.fieldGroups.map((group) => {
        const fields = getFieldsByGroup(group.name);
        if (fields.length === 0) return null;

        return (
          <div key={group.name} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {group.name}
            </h3>
            <div className="space-y-6">
              {/* Special handling for price + currency */}
              {group.name === 'Pricing' && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Currency
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      disabled={isBusy}
                      {...register('priceCurrency')}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                  </div>
                  {renderField('price')}
                </div>
              )}
              
              {/* Render other fields in the group */}
              {fields
                .filter((fieldName) => {
                  // Skip price if we're in pricing group (handled above)
                  if (group.name === 'Pricing' && fieldName === 'price') return false;
                  // Skip priceCurrency (handled above)
                  if (fieldName === 'priceCurrency') return false;
                  return true;
                })
                .map((fieldName) => renderField(fieldName))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

