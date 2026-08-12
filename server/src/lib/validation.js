import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email().max(320)
export const passwordSchema = z.string().min(8).max(128)
export const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code')

export const designerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  birthdate: z.coerce.date(),
  mobileNumber: z.string().regex(/^\+63\d{10}$/, 'Mobile number must be +63 followed by 10 digits'),
  company: z.string().trim().max(255).nullable().optional(),
  officeAddress: z.string().trim().max(500).nullable().optional(),
  companyWebsite: z.string().trim().url().max(2048).nullable().optional(),
  touchpoint: z.string().trim().min(1).max(255),
  howDidYouHearAboutUs: z.string().trim().min(1).max(1000)
}).strict()

export const designerUpdateSchema = designerSchema.partial().refine((value) => Object.keys(value).length > 0, 'Provide at least one designer field')
