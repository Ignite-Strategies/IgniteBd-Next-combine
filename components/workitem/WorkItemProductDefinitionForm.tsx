'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { WorkItemProductDefinitionFormData } from '@/lib/schemas/workItemProductDefinitionSchema';

interface WorkItemProductDefinitionFormProps {
  register: UseFormRegister<WorkItemProductDefinitionFormData>;
  errors: FieldErrors<WorkItemProductDefinitionFormData>;
  isBusy: boolean;
  personas?: Array<{ id: string; name: string }>;
}

/**
 * WorkItem Product Definition Form Fields
 * Replicates BD Product Definition fields but for WorkItem context
 */
export function WorkItemProductDefinitionForm({
  register,
  errors,
  isBusy,
  personas = [],
}: WorkItemProductDefinitionFormProps) {
  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Basic Information
        </h3>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Product/Service Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name', { required: 'Product/Service Name is required' })}
              type="text"
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              placeholder="e.g., Business Development Platform, Ignite CRM Automation"
              maxLength={255}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
            <p className="text-xs text-gray-500">
              A clear, concise name for your product or service
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Category</label>
            <input
              {...register('category')}
              type="text"
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              placeholder="e.g., Software, Consulting, Training"
              maxLength={100}
            />
            {errors.category && (
              <p className="text-xs text-red-500">{errors.category.message}</p>
            )}
            <p className="text-xs text-gray-500">Category or type of product/service</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Value Proposition</label>
            <textarea
              {...register('valueProp')}
              rows={4}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              placeholder="What specific outcome or benefit does this product deliver?"
            />
            {errors.valueProp && (
              <p className="text-xs text-red-500">{errors.valueProp.message}</p>
            )}
            <p className="text-xs text-gray-500">
              This is used by BD Intelligence to calculate fit scores with contacts
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              placeholder="Additional details about the product experience, features, or use cases."
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
            <p className="text-xs text-gray-500">Optional: Additional details about the product</p>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Pricing
        </h3>
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Currency</label>
              <select
                {...register('priceCurrency')}
                disabled={isBusy}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              >
                <option value="">Select currency</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
              </select>
              <p className="text-xs text-gray-500">Currency for the price</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Price</label>
              <input
                {...register('price', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                disabled={isBusy}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                placeholder="0.00"
              />
              {errors.price && (
                <p className="text-xs text-red-500">{errors.price.message}</p>
              )}
              <p className="text-xs text-gray-500">Product/service price for BD Intelligence scoring</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Pricing Model</label>
            <select
              {...register('pricingModel')}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
            >
              <option value="">Select pricing model</option>
              <option value="one-time">One-Time Payment</option>
              <option value="recurring">Recurring (Monthly/Annual)</option>
              <option value="usage-based">Usage-Based</option>
              <option value="freemium">Freemium</option>
              <option value="custom">Custom</option>
            </select>
            {errors.pricingModel && (
              <p className="text-xs text-red-500">{errors.pricingModel.message}</p>
            )}
            <p className="text-xs text-gray-500">How is this product/service priced?</p>
          </div>
        </div>
      </div>

      {/* Targeting & Market */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Targeting & Market
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Targeted To</label>
            <select
              {...register('targetedTo')}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
            >
              <option value="">Select a persona (optional)</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name || 'Unnamed Persona'}
                </option>
              ))}
            </select>
            {errors.targetedTo && (
              <p className="text-xs text-red-500">{errors.targetedTo.message}</p>
            )}
            <p className="text-xs text-gray-500">Which persona is this product targeted to?</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Target Market Size</label>
            <select
              {...register('targetMarketSize')}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
            >
              <option value="">Select market size</option>
              <option value="enterprise">Enterprise (1000+ employees)</option>
              <option value="mid-market">Mid-Market (100-999 employees)</option>
              <option value="small-business">Small Business (10-99 employees)</option>
              <option value="startup">Startup (1-9 employees)</option>
              <option value="individual">Individual/Solo</option>
            </select>
            {errors.targetMarketSize && (
              <p className="text-xs text-red-500">{errors.targetMarketSize.message}</p>
            )}
            <p className="text-xs text-gray-500">
              What size companies is this product/service targeted to?
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Sales Cycle Length</label>
            <select
              {...register('salesCycleLength')}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
            >
              <option value="">Select sales cycle</option>
              <option value="immediate">Immediate (Same Day)</option>
              <option value="short">Short (1-2 weeks)</option>
              <option value="medium">Medium (1-3 months)</option>
              <option value="long">Long (3-6 months)</option>
              <option value="very-long">Very Long (6+ months)</option>
            </select>
            {errors.salesCycleLength && (
              <p className="text-xs text-red-500">{errors.salesCycleLength.message}</p>
            )}
            <p className="text-xs text-gray-500">
              Typical length of the sales cycle for this product/service
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Details
        </h3>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Delivery Timeline</label>
            <input
              {...register('deliveryTimeline')}
              type="text"
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              placeholder="e.g., 2-4 weeks, 3 months, Immediate"
              maxLength={100}
            />
            {errors.deliveryTimeline && (
              <p className="text-xs text-red-500">{errors.deliveryTimeline.message}</p>
            )}
            <p className="text-xs text-gray-500">
              How long does it take to deliver this product/service?
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Key Features</label>
            <textarea
              {...register('features')}
              rows={4}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              placeholder="List key features, one per line or bullet points"
            />
            {errors.features && (
              <p className="text-xs text-red-500">{errors.features.message}</p>
            )}
            <p className="text-xs text-gray-500">Main features or capabilities of this product/service</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Competitive Advantages</label>
            <textarea
              {...register('competitiveAdvantages')}
              rows={3}
              disabled={isBusy}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
              placeholder="What makes this product/service unique or better than alternatives?"
            />
            {errors.competitiveAdvantages && (
              <p className="text-xs text-red-500">{errors.competitiveAdvantages.message}</p>
            )}
            <p className="text-xs text-gray-500">Unique selling points and competitive advantages</p>
          </div>
        </div>
      </div>
    </div>
  );
}

