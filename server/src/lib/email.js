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
    }
  }
}
