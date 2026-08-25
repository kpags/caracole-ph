const MANILA_TIME_ZONE = 'Asia/Manila'
export const REJECTED_DESIGNER_RETENTION_DAYS = 15

function manilaDateParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

export function rejectedDesignerPurgeCutoff(now = new Date()) {
  const { year, month, day } = manilaDateParts(now)
  const cutoff = new Date(`${year}-${month}-${day}T00:00:00+08:00`)
  cutoff.setUTCDate(cutoff.getUTCDate() - (REJECTED_DESIGNER_RETENTION_DAYS - 1))
  return cutoff
}

export async function purgeRejectedDesigners(prisma, { now = new Date(), logger = console } = {}) {
  const cutoff = rejectedDesignerPurgeCutoff(now)
  const result = await prisma.user.deleteMany({
    where: {
      isDesigner: true,
      designer: {
        is: {
          reviewStatus: 'REJECTED',
          reviewedAt: { lt: cutoff }
        }
      }
    }
  })
  logger.log(`Rejected-designer cleanup completed: ${result.count} account(s) deleted; reviewed before ${cutoff.toISOString()} were eligible.`)
  return { cutoff, deletedCount: result.count }
}
