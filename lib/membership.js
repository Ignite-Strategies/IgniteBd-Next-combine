import { prisma } from './prisma';

/**
 * Resolves membership for an owner in a specific CompanyHQ
 * 
 * @param {string} ownerId - The owner.id (not firebaseId)
 * @param {string} companyHQId - The companyHQ.id
 * @returns {Promise<{membership: object|null, role: string|null}>}
 * 
 * @example
 * const { membership, role } = await resolveMembership(owner.id, companyHQId);
 * if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */
export async function resolveMembership(ownerId, companyHQId) {
  if (!ownerId || !companyHQId) {
    return { membership: null, role: null };
  }

  try {
    const membership = await prisma.company_memberships.findUnique({
      where: {
        userId_companyHqId: {
          userId: ownerId,
          companyHqId: companyHQId,
        }
      },
      include: {
        owners: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          }
        }
      }
    });

    if (!membership) {
      return { membership: null, role: null };
    }

    return {
      membership,
      role: membership.role,
    };
  } catch (error) {
    console.error('Error resolving membership:', error);
    return { membership: null, role: null };
  }
}

/**
 * Resolves ALL memberships for an owner (across all CompanyHQs)
 * 
 * @param {string} ownerId - The owner.id
 * @returns {Promise<Array>} Array of membership records
 * 
 * @example
 * const memberships = await resolveAllMemberships(owner.id);
 * // Returns: [{ companyHqId, role, company_hqs: { companyName } }, ...]
 */
export async function resolveAllMemberships(ownerId) {
  if (!ownerId) {
    return [];
  }

  try {
    const memberships = await prisma.company_memberships.findMany({
      where: {
        userId: ownerId,
      },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
            platformId: true,
          }
        }
      },
      orderBy: [
        { isPrimary: 'desc' }, // Primary first
        { createdAt: 'asc' },  // Then by creation date
      ]
    });

    return memberships;
  } catch (error) {
    console.error('Error resolving all memberships:', error);
    return [];
  }
}

/**
 * Checks if owner has a specific role in a CompanyHQ
 * 
 * @param {string} ownerId - The owner.id
 * @param {string} companyHQId - The companyHQ.id
 * @param {string} requiredRole - The required role (e.g., 'OWNER', 'MANAGER')
 * @returns {Promise<boolean>}
 * 
 * @example
 * const isOwner = await hasRole(owner.id, companyHQId, 'OWNER');
 * if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */
export async function hasRole(ownerId, companyHQId, requiredRole) {
  const { role } = await resolveMembership(ownerId, companyHQId);
  return role === requiredRole;
}
