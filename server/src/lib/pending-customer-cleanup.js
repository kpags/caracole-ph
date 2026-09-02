const MANILA_TIME_ZONE = 'Asia/Manila'
export const PENDING_CUSTOMER_RETENTION_DAYS = 7

function manilaDateParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

export function pendingCustomerPurgeCutoff(now = new Date()) {
  const { year, month, day } = manilaDateParts(now)
  const cutoff = new Date(`${year}-${month}-${day}T00:00:00+08:00`)
  cutoff.setUTCDate(cutoff.getUTCDate() - (PENDING_CUSTOMER_RETENTION_DAYS - 1))
  return cutoff
}

export async function purgePendingCustomers(prisma, { now = new Date(), logger = console } = {}) {
  const cutoff = pendingCustomerPurgeCutoff(now)
  const result = await prisma.user.deleteMany({
    where: {
      isActive: false,
      isEmailVerified: false,
      isDesigner: false,
      isStaff: false,
      isSuperuser: false,
      OR: [
        { customer: { is: null } },
        { customer: { is: { source: 'WEBSITE' } } }
      ],
      createdAt: { lt: cutoff }
    }
  })
  logger.log(`Pending-customer cleanup completed: ${result.count} account(s) deleted; created before ${cutoff.toISOString()} were eligible.`)
  return { cutoff, deletedCount: result.count }
}
