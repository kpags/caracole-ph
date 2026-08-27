export const userSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  firstName: true,
  lastName: true,
  isDesigner: true,
  isStaff: true,
  isSuperuser: true,
  isActive: true,
  isEmailVerified: true,
  designer: {
    include: {
      reviewedBy: { select: { id: true, email: true } }
    }
  }
}

export function designerData(designer) {
  return {
    firstName: designer.firstName,
    lastName: designer.lastName,
    birthdate: designer.birthdate,
    mobileNumber: designer.mobileNumber,
    company: designer.company ?? null,
    officeAddress: designer.officeAddress ?? null,
    companyWebsite: designer.companyWebsite ?? null,
    touchpoint: designer.touchpoint,
    howDidYouHearAboutUs: designer.howDidYouHearAboutUs
  }
}
