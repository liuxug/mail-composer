import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: parseInt(process.env.SMTP_PORT) === 465,
  requireTLS: parseInt(process.env.SMTP_PORT) === 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: `"邮箱集成系统" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '邮箱验证码',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); border-radius: 12px; padding: 40px 30px; text-align: center;">
          <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <h1 style="color: white; font-size: 24px; margin: 0 0 10px;">邮箱验证码</h1>
          <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">您正在注册邮箱集成系统</p>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 12px 12px;">
          <p style="color: #64748b; font-size: 16px; text-align: center; margin: 0 0 20px;">请输入以下验证码完成验证：</p>
          <div style="text-align: center;">
            <span style="font-size: 48px; font-weight: bold; color: #1e293b; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 20px 0 0;">验证码有效期为5分钟，请尽快使用</p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 5px 0 0;">如果不是您本人操作，请忽略此邮件</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification code sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send verification code to ${email}:`, error.message);
    throw new Error('发送验证码失败，请稍后重试');
  }
}

export async function sendPasswordResetEmail(email, code) {
  const mailOptions = {
    from: `"邮箱集成系统" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '重置密码验证码',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 12px; padding: 40px 30px; text-align: center;">
          <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
              <path d="M16 21h5v-5"></path>
            </svg>
          </div>
          <h1 style="color: white; font-size: 24px; margin: 0 0 10px;">重置密码</h1>
          <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">您正在重置邮箱集成系统的密码</p>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 12px 12px;">
          <p style="color: #64748b; font-size: 16px; text-align: center; margin: 0 0 20px;">请输入以下验证码完成密码重置：</p>
          <div style="text-align: center;">
            <span style="font-size: 48px; font-weight: bold; color: #1e293b; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 20px 0 0;">验证码有效期为5分钟，请尽快使用</p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 5px 0 0;">如果不是您本人操作，请忽略此邮件</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset code sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send password reset code to ${email}:`, error.message);
    throw new Error('发送验证码失败，请稍后重试');
  }
}