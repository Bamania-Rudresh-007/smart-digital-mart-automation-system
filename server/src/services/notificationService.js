const nodemailer = require('nodemailer');
const { Notification } = require('../models');
const logger = require('../utils/logger');

class NotificationService {
  static getTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
    return null;
  }

  static async sendEmail({ to, subject, text, html }) {
    const transporter = this.getTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@sdmas-mart.com',
          to,
          subject,
          text,
          html
        });
        logger.info(`Email sent to ${to}: ${subject}`);
      } catch (err) {
        logger.error(`Failed to send email to ${to}: ${err.message}`);
      }
    } else {
      logger.info(`[DEV EMAIL MOCK] To: ${to} | Subject: ${subject} | Body: ${text || html}`);
    }
  }

  static async sendSMS({ phone, message }) {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        logger.info(`SMS sent to ${phone}`);
      } catch (err) {
        logger.error(`SMS dispatch error: ${err.message}`);
      }
    } else {
      logger.info(`[DEV SMS MOCK] To: ${phone} | Message: ${message}`);
    }
  }

  static async createInApp({ userId, title, message, type = 'info', link = null }) {
    try {
      const notif = await Notification.create({
        user_id: userId,
        title,
        message,
        type,
        link,
        is_read: false
      });
      return notif;
    } catch (err) {
      logger.error('Failed to create in-app notification: ' + err.message);
    }
  }
}

module.exports = NotificationService;
