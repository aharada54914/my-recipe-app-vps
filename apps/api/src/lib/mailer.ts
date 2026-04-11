import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  const host = process.env['SMTP_HOST']
  const portStr = process.env['SMTP_PORT']
  const user = process.env['SMTP_USER']
  const pass = process.env['SMTP_PASS']

  if (!host || !user || !pass) {
    throw new Error('SMTP environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS) are required')
  }

  transporter = nodemailer.createTransport({
    host,
    port: portStr ? Number.parseInt(portStr, 10) : 587,
    secure: portStr === '465',
    auth: { user, pass },
  })

  return transporter
}

export interface WeeklyMenuEmailData {
  userName: string
  periodLabel: string
  items: Array<{
    date: string
    dayOfWeek: string
    mainTitle: string
    sideTitle?: string
  }>
  shoppingList?: string
}

function buildWeeklyMenuHtml(data: WeeklyMenuEmailData): string {
  const menuRows = data.items
    .map(item => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #F97316;">
          ${item.dayOfWeek} (${item.date})
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
          ${item.mainTitle}${item.sideTitle ? ` + ${item.sideTitle}` : ''}
        </td>
      </tr>
    `)
    .join('')

  const shoppingSection = data.shoppingList
    ? `
      <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 8px; color: #333;">買い物リスト</h3>
        <pre style="margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 14px;">${data.shoppingList}</pre>
      </div>
    `
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background: linear-gradient(135deg, #F97316, #ea580c); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 20px;">Kitchen App - 献立</h1>
        <p style="margin: 4px 0 0; opacity: 0.9;">${data.periodLabel}</p>
      </div>
      <div style="border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
        <p>こんにちは、${data.userName}さん</p>
        <p>献立をお届けします:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${menuRows}
        </table>
        ${shoppingSection}
        <p style="margin-top: 24px; font-size: 12px; color: #999;">
          このメールは Kitchen App から自動送信されています。
        </p>
      </div>
    </body>
    </html>
  `
}

export async function sendWeeklyMenuEmail(
  to: string,
  data: WeeklyMenuEmailData,
): Promise<void> {
  const transport = getTransporter()
  const from = process.env['SMTP_USER']

  await transport.sendMail({
    from: `Kitchen App <${from}>`,
    to,
    subject: `献立 (${data.periodLabel})`,
    html: buildWeeklyMenuHtml(data),
  })
}
