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

    // Calculate endsAt based on interval
    const now = new Date();
    const endsAt = new Date(now);
    if (plan.interval === 'YEAR' || plan.interval === 'year') {
      endsAt.setFullYear(endsAt.getFullYear() + 1);
    } else {
      endsAt.setMonth(endsAt.getMonth() + 1);
    }

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
            endsAt,
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
            endsAt,
          },
        });

    return platformAccess;
  }

  /**
   * Pause access (temporary suspension)
   * 
   * @param {string} platformAccessId - PlatformAccess.id
   * @returns {Promise<Object>} Updated PlatformAccess
   */
  static async pauseAccess(platformAccessId) {
    const platformAccess = await prisma.platform_accesses.update({
      where: { id: platformAccessId },
      data: {
        status: 'PAUSED',
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
        status: 'EXPIRED',
        endsAt: new Date(),
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
        endsAt: {
          gt: new Date(),
        },
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

