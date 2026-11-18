import { prisma } from '../../shared/prisma.js'

export const SANCTION_DELTA = { LATE_10: -5, LATE_MORE: -10, NO_SHOW: -15, WARNING: 0 }

export function approvedBookingBlock(userId) {
  return prisma.sanction.findFirst({
    where: { userId, status: 'APPROVED', bookingBlocked: true },
  })
}
