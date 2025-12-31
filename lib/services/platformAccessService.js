import { prisma } from '@/lib/prisma';

/**
 * PlatformAccessService
 * 
 * Authoritative service for platform access management.
 * 
 * PlatformAccess is the source of truth for entitlement.
 * Stripe enforces payment; this system enforces access.
 * 
 * Only place that mutates PlatformAccess.status.
 * Called by Stripe webhook and admin actions.
 * Stripe logic does not live here.
 * 
 * @comment PlatformAccess is the source of truth for entitlement.
 * Stripe enforces payment; this system enforces access.
 */
class PlatformAccessService {
  /**
   * Grant access to a company for a plan
   * 
   * @param {string} companyId - CompanyHQ.id
   * @param {string} planId - Plan.id
   * @param {string} [stripeSubscriptionId] - Optional Stripe subscription ID
   * @returns {Promise<Object>} Created PlatformAccess
   */
  static async grantAccess(companyId, planId, stripeSubscriptionId = null) {
    // Fetch plan to get name
    const plan = await prisma.plans.findUnique({
      where: { id: planId },
      select: { id: true, name: true, interval: true },
    });

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Calculate endedAt based on interval (only for recurring plans)
    const now = new Date();
    let endedAt = null;
    if (plan.interval === 'YEAR' || plan.interval === 'year') {
      endedAt = new Date(now);
      endedAt.setFullYear(endedAt.getFullYear() + 1);
    } else if (plan.interval === 'MONTH' || plan.interval === 'month') {
      endedAt = new Date(now);
      endedAt.setMonth(endedAt.getMonth() + 1);
    }
    // For one-time plans (interval is null), endedAt remains null

    // Check if access already exists
    const existing = await prisma.platform_accesses.findFirst({
      where: {
        companyId,
        planId,
      },
    });

    // Create or update PlatformAccess
    const platformAccess = existing
      ? await prisma.platform_accesses.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            stripeSubscriptionId: stripeSubscriptionId || existing.stripeSubscriptionId,
            startedAt: now,
            endedAt,
            name: plan.name,
          },
        })
      : await prisma.platform_accesses.create({
          data: {
            companyId,
            planId,
            status: 'ACTIVE',
            stripeSubscriptionId: stripeSubscriptionId || undefined,
            name: plan.name,
            startedAt: now,
            endedAt,
          },
        });

    return platformAccess;
  }

  /**
   * Pause access (temporary suspension)
   * Note: Uses PAST_DUE status (PAUSED removed from enum)
   * 
   * @param {string} platformAccessId - PlatformAccess.id
   * @returns {Promise<Object>} Updated PlatformAccess
   */
  static async pauseAccess(platformAccessId) {
    const platformAccess = await prisma.platform_accesses.update({
      where: { id: platformAccessId },
      data: {
        status: 'PAST_DUE', // Changed from PAUSED to PAST_DUE
      },
    });

    return platformAccess;
  }

  /**
   * Revoke access (permanent removal)
   * 
   * @param {string} platformAccessId - PlatformAccess.id
   * @returns {Promise<Object>} Updated PlatformAccess
   */
  static async revokeAccess(platformAccessId) {
    const platformAccess = await prisma.platform_accesses.update({
      where: { id: platformAccessId },
      data: {
        status: 'CANCELED',
        endedAt: new Date(),
      },
    });

    return platformAccess;
  }

  /**
   * Ensure company has active access for a plan
   * Called by webhook when payment succeeds
   * 
   * @param {string} companyId - CompanyHQ.id
   * @param {string} planId - Plan.id
   * @param {string} [stripeSubscriptionId] - Optional Stripe subscription ID
   * @returns {Promise<Object>} PlatformAccess
   */
  static async ensureActive(companyId, planId, stripeSubscriptionId = null) {
    return this.grantAccess(companyId, planId, stripeSubscriptionId);
  }

  /**
   * Get active access for a company
   * 
   * @param {string} companyId - CompanyHQ.id
   * @returns {Promise<Object|null>} Active PlatformAccess or null
   */
  static async getActiveAccess(companyId) {
    const access = await prisma.platform_accesses.findFirst({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [
          { endedAt: null }, // No end date (lifetime/one-time)
          { endedAt: { gt: new Date() } }, // Not expired yet
        ],
      },
      include: {
        plans: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    return access;
  }
}

export default PlatformAccessService;

