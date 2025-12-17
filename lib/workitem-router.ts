// Map of Work Item display labels to canonical route slugs
export const WORK_ITEM_SLUGS: Record<string, string> = {
  "Product Definition": "product-definition",
  "Target Personas": "target-personas",
  "Event Selection": "event-selection",
  "Ecosystem Map": "ecosystem-map",
  // Extend later with other phases or custom items
};

export function getWorkItemSlug(label: string): string | null {
  return WORK_ITEM_SLUGS[label] ?? null;
}

export function getWorkItemRoute(label: string, workPackageItemId?: string): string {
  const slug = getWorkItemSlug(label);

  if (!slug) {
    // fallback route for unmapped items
    const params = new URLSearchParams();
    params.set('label', label);
    if (workPackageItemId) {
      params.set('workPackageItemId', workPackageItemId);
    }
    return `/ignite/work-item/generic?${params.toString()}`;
  }

  // Add workPackageItemId as query parameter
  const params = new URLSearchParams();
  if (workPackageItemId) {
    params.set('workPackageItemId', workPackageItemId);
  }
  const queryString = params.toString();
  return `/ignite/work-item/${slug}${queryString ? `?${queryString}` : ''}`;
}

