export const ABANDONED_AFTER_DAYS = 7

export function abandonedCartCutoff(now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - ABANDONED_AFTER_DAYS)
  return cutoff
}

export async function abandonInactiveCarts(prisma, { now = new Date(), logger = console } = {}) {
  const cutoff = abandonedCartCutoff(now)
  const result = await prisma.cart.updateMany({
    where: { status: 'ACTIVE', itemCount: { gt: 0 }, updatedAt: { lte: cutoff } },
    data: { status: 'ABANDONED' }
  })
  logger.log(`Cart abandonment cleanup completed: cutoff=${cutoff.toISOString()} abandoned=${result.count}`)
  return { cutoff, count: result.count }
}
