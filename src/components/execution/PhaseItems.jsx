'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, PlayCircle } from 'lucide-react';
import { getStatusOptions } from '@/lib/config/statusConfig';

// Helper to get builder route from deliverableType
function getBuilderRoute(deliverableType, workPackageId, itemId) {
  const typeMap = {
    blog: '/builder/blog',
    persona: '/builder/persona',
    page: '/builder/landingpage',
    landing_page: '/builder/landingpage',
    deck: '/builder/cledeck',
    cledeck: '/builder/cledeck',
    template: '/builder/template',
    outreach_template: '/builder/template',
    event: '/builder/event',
    event_targets: '/builder/event',
  };

  const baseRoute = typeMap[deliverableType?.toLowerCase()] || '/builder/blog';
  return `${baseRoute}/new?workPackageId=${workPackageId}&itemId=${itemId}`;
}

export default function PhaseItems({ items, workPackageId, onItemStatusUpdate }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const statusOptions = getStatusOptions(false); // owner view

  if (!items || items.length === 0) {
    return (
      <div className="border-t pt-4 mt-4">
        <p className="text-sm text-gray-500">No items in this phase</p>
      </div>
    );
  }

  const handleDoWorkItem = (item) => {
    if (!workPackageId || !item?.id) return;
    const route = getBuilderRoute(item.deliverableType || item.itemType, workPackageId, item.id);
    router.push(route);
  };

  const handleStatusUpdate = async (itemId, newStatus) => {
    setUpdatingStatus({ ...updatingStatus, [itemId]: true });
    try {
      await onItemStatusUpdate(itemId, newStatus);
    } finally {
      setUpdatingStatus({ ...updatingStatus, [itemId]: false });
    }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900"
      >
        <span>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const itemLabel = item.deliverableLabel || item.itemLabel || 'Untitled Item';
            const itemStatus = item.status || 'NOT_STARTED';
            const itemDescription = item.deliverableDescription || item.itemDescription;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-gray-300"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{itemLabel}</div>
                  {itemDescription && (
                    <div className="mt-1 text-sm text-gray-500">{itemDescription}</div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Status Dropdown */}
                  <select
                    value={itemStatus}
                    onChange={(e) => handleStatusUpdate(item.id, e.target.value)}
                    disabled={updatingStatus[item.id]}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {/* Do this work item button */}
                  <button
                    onClick={() => handleDoWorkItem(item)}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Do this work item
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

