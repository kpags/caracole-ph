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
    }
  }
}
