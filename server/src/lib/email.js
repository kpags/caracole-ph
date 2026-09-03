import fs from 'node:fs/promises'
import path from 'node:path'
import Handlebars from 'handlebars'
import nodemailer from 'nodemailer'

const templateCache = new Map()

async function loadTemplate(name) {
  if (!templateCache.has(name)) {
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'email', name, 'template.html')
    const source = await fs.readFile(templatePath, 'utf8')
    templateCache.set(name, Handlebars.compile(source))
  }
  return templateCache.get(name)
}

function designerTemplateContext(designer, appConfig) {
  const registeredAt = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Manila'
  }).format(new Date())

  return {
    appName: appConfig.APP_NAME,
    adminDashboardUrl: appConfig.ADMIN_DASHBOARD_URL,
    firstName: designer.firstName,
    lastName: designer.lastName,
    fullName: [designer.firstName, designer.lastName].filter(Boolean).join(' '),
    email: designer.email,
    mobileNumber: designer.mobileNumber,
    birthdate: designer.birthdate ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }).format(new Date(designer.birthdate)) : '--',
    company: designer.company || '--',
    officeAddress: designer.officeAddress || '--',
    companyWebsite: designer.companyWebsite || '--',
    touchpoint: designer.touchpoint || '--',
    howDidYouHearAboutUs: designer.howDidYouHearAboutUs || '--',
    registeredAt
  }
}

function adminInvitationTemplateContext(invitedUser, token, appConfig) {
  const setupPasswordUrl = new URL(appConfig.ADMIN_INVITATION_SETUP_URL)
  setupPasswordUrl.searchParams.set('token', token)

  return {
    appName: appConfig.APP_NAME,
    firstName: invitedUser.firstName,
    fullName: [invitedUser.firstName, invitedUser.lastName].filter(Boolean).join(' '),
    role: invitedUser.isSuperuser ? 'Superuser' : 'Staff',
    setupPasswordUrl: setupPasswordUrl.toString()
  }
}

function inquiryTemplateContext(inquiry, appConfig) {
  return {
    appName: appConfig.APP_NAME,
    firstName: inquiry.firstName,
    lastName: inquiry.lastName,
    fullName: [inquiry.firstName, inquiry.lastName].filter(Boolean).join(' '),
    email: inquiry.email,
    contactNumber: inquiry.contactNumber,
    inquiry: inquiry.message,
    productName: inquiry.productName,
    edpNumber: inquiry.edpNumber,
    status: inquiry.status,
    inquiredAt: new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Manila'
    }).format(new Date(inquiry.createdAt))
  }
}

export function createMailer(config) {
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
  })

  return {
    async sendOtp({ template, email, firstName, otp, config: appConfig }) {
      const render = await loadTemplate(template)
      const subject = template === 'signup-otp' ? `Verify your ${appConfig.APP_NAME} email` : `Reset your ${appConfig.APP_NAME} password`
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: email,
        subject,
        html: render({ otp, firstName, appName: appConfig.APP_NAME }),
        text: `${appConfig.APP_NAME}: your one-time code is ${otp}. It expires in 10 minutes.`
      })
    },
    async sendDesignerRegistrationConfirmation({ designer, config: appConfig }) {
      const render = await loadTemplate('designer-registration-confirmation')
      const context = designerTemplateContext(designer, appConfig)
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: designer.email,
        subject: `Thank you for registering with ${appConfig.APP_NAME}`,
        html: render(context),
        text: `Hello ${context.firstName}, we have received your designer registration and our team is reviewing it. You will receive an update from ${appConfig.APP_NAME} once the review is complete.`
      })
    },
    async sendDesignerRegistrationNotification({ designer, recipients, config: appConfig }) {
      if (!recipients.length) return
      const render = await loadTemplate('designer-registration-notification')
      const context = designerTemplateContext(designer, appConfig)
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: recipients,
        subject: `New Designer Registration — ${context.fullName}`,
        html: render(context),
        text: `A new designer registration is awaiting review. Name: ${context.fullName}; email: ${context.email}; mobile: ${context.mobileNumber}. Review it at ${context.adminDashboardUrl}.`
      })
    },
    async sendNewsletterSubscriptionConfirmation({ email, config: appConfig }) {
      const render = await loadTemplate('newsletter-subscription-confirmation')
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: email,
        subject: 'Thank You for Subscribing to our Newsletter',
        html: render({ appName: appConfig.APP_NAME }),
        text: `Thank you for subscribing to ${appConfig.APP_NAME}. You will now receive promotions, events, and announcements from Caracole Philippines.`
      })
    },
    async sendInquiryConfirmation({ inquiry, config: appConfig }) {
      const render = await loadTemplate('inquiry-confirmation')
      const context = inquiryTemplateContext(inquiry, appConfig)
      const productDetails = context.productName ? ` regarding ${context.productName}${context.edpNumber ? ` (EDP ${context.edpNumber})` : ''}` : ''
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: inquiry.email,
        subject: `We've received your inquiry — ${appConfig.APP_NAME}`,
        html: render(context),
        text: `Hello ${context.firstName}, thank you for contacting ${appConfig.APP_NAME}. Your inquiry${productDetails} has been received and is being reviewed by the Caracole PH team.`
      })
    },
    async sendInquiryNotification({ inquiry, recipients, config: appConfig }) {
      if (!recipients.length) return
      const render = await loadTemplate('inquiry-notification')
      const context = inquiryTemplateContext(inquiry, appConfig)
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: recipients,
        subject: `New Inquiry — ${context.fullName}`,
        html: render(context),
        text: `A new inquiry is awaiting review. Status: ${context.status}. Name: ${context.fullName}; email: ${context.email}; contact number: ${context.contactNumber}; inquiry: ${context.inquiry}; date inquired: ${context.inquiredAt} (PHT).`
      })
    },
    async sendDesignerReviewDecision({ designer, status, config: appConfig }) {
      const approved = status === 'APPROVED'
      const render = await loadTemplate(approved ? 'designer-approved' : 'designer-rejected')
      const context = designerTemplateContext(designer, appConfig)
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: designer.email,
        subject: approved
          ? `Welcome to ${appConfig.APP_NAME} as one of our designers!`
          : `Thank you for your interest in ${appConfig.APP_NAME}`,
        html: render(context),
        text: approved
          ? `Hello ${context.firstName}, your designer registration has been approved. Welcome to ${appConfig.APP_NAME} as one of our designers.`
          : `Hello ${context.firstName}, thank you for taking the time to register as a designer with ${appConfig.APP_NAME}. After careful review, we are unable to move forward with your application at this time.`
      })
    },
    async sendAdminInvitation({ user, token, config: appConfig }) {
      const render = await loadTemplate('admin-invitation')
      const context = adminInvitationTemplateContext(user, token, appConfig)
      await transporter.sendMail({
        from: appConfig.EMAIL_FROM,
        to: user.email,
        subject: `You're invited to become a ${appConfig.APP_NAME} administrator`,
        html: render(context),
        text: `Hello ${context.firstName}, you have been invited to join ${appConfig.APP_NAME} as a ${context.role} administrator. Set up your password here: ${context.setupPasswordUrl}`
      })
    }
  }
}
