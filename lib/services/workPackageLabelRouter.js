/**
 * WorkPackage Label Router Service
 * Maps WorkPackageItem labels to UX routes for navigation
 * 
 * Routes by LABEL only - as specified in requirements
 */

/**
 * Label to route mapping
 * Maps each WorkPackageItem.label (or deliverableLabel) to a corresponding UX route
 */
export const labelRouter = {
  blog_post: '/builder/blog',
  blog: '/builder/blog',
  persona: '/builder/persona',
  personas: '/builder/persona',
  deck: '/builder/presentation',
  presentation: '/builder/presentation',
  cledeck: '/builder/presentation',
  cle_deck: '/builder/presentation',
  template: '/builder/template',
  outreach_template: '/builder/template',
  landing_page: '/builder/landingpage',
  page: '/builder/landingpage',
  ecosystem: '/builder/landingpage',
  event: '/builder/event',
  event_targets: '/builder/event',
  research: '/builder/research', // May need to create
  deliverable: '/workpackages', // Generic - routes to item detail
  // NOTE: Artifacts system removed - commented out until rewire
  // artifact: '/workpackages', // Generic - routes to item detail
  summary: '/builder/summary', // May need to create
  client_review: '/owner/work/review', // May need to create
  review: '/owner/work/review', // May need to create
};

/**
 * Get route for a WorkPackageItem based on its label
 * @param {Object} item - WorkPackageItem object
 * @returns {string|null} - Route path or null if no mapping found
 */
export function getRouteForItem(item) {
  if (!item) return null;

  // Get label (deliverableLabel first, then itemLabel)
  const label = (item.deliverableLabel || item.itemLabel || '').toLowerCase().trim();
  
  if (!label) return null;

  // Direct match
  if (labelRouter[label]) {
    return labelRouter[label];
  }

  // Try partial matches (e.g., "blog post" contains "blog")
  for (const [key, route] of Object.entries(labelRouter)) {
    if (label.includes(key) || key.includes(label)) {
      return route;
    }
  }

  return null;
}

/**
 * Build full route with item ID
 * Routes to existing collateral if available, otherwise to create new
 * Matches the exact format expected by builder pages (useSearchParams)
 * NOTE: Artifacts system removed - commented out until rewire
 * 
 * @param {Object} item - WorkPackageItem object (should have collateral from hydration)
 * @param {string} workPackageId - WorkPackage ID
 * @returns {string|null} - Full route path, or null if no route found
 */
export function buildItemRoute(item, workPackageId) {
  if (!item || !item.id || !workPackageId) return null;

  const baseRoute = getRouteForItem(item);
  if (!baseRoute) {
    // No route mapping - fallback to item detail page
    return `/workpackages/${workPackageId}/items/${item.id}`;
  }

  // Special handling for generic routes (deliverable)
  // NOTE: Artifacts system removed - commented out until rewire
  if (baseRoute === '/workpackages') {
    return `/workpackages/${workPackageId}/items/${item.id}`;
  }

  // Check if item has existing collateral (work collateral system)
  // NOTE: Artifacts system removed - commented out until rewire
  // Collateral links items to content via collateralRefId
  const collateral = item.collateral || [];
  
  if (collateral.length > 0) {
    // Use the first collateral's collateralRefId as the content ID
    const firstCollateral = collateral[0];
    const contentId = firstCollateral.collateralRefId;
    if (contentId) {
      // Format: /builder/blog/[blogId]?workPackageId=xxx&itemId=yyy
      // collateralRefId is the actual content ID (blog.id, persona.id, etc.)
      return `${baseRoute}/${contentId}?workPackageId=${workPackageId}&itemId=${item.id}`;
    }
  }

  // No collateral yet - route to create new
  // Format: /builder/blog/new?workPackageId=xxx&itemId=yyy
  return `${baseRoute}/new?workPackageId=${workPackageId}&itemId=${item.id}`;
}

