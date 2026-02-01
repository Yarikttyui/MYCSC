import * as nodemailer from 'nodemailer';
const EMAIL_CONFIG = {
  host: 'smtp.mail.ru',
  port: 465,
  secure: true,
  auth: {
    user: 'mycsc@mail.ru',
    pass: process.env.EMAIL_PASSWORD || 'QbjRbdfCEJLTfmJm6XkE'
  }
};
const transporter = nodemailer.createTransport(EMAIL_CONFIG);
const createEmailTemplate = (title: string, content: string, buttonText?: string, buttonUrl?: string) => `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%); min-height: 100vh;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 560px; border-collapse: collapse; background: linear-gradient(145deg, #1e1e2e 0%, #252536 100%); border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); padding: 48px 40px; text-align: center; position: relative;">
              <table role="presentation" style="margin: 0 auto 20px; width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 20px;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="https://adskoekoleso.ru/logo.png" alt="MYCSC" width="50" height="50" style="display: block; border-radius: 8px;" />
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                MYCSC Database
              </h1>
              <p style="margin: 12px 0 0; color: rgba(255,255,255,0.9); font-size: 15px; font-weight: 400;">
                Современная система управления базами данных
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px; color: #ffffff; font-size: 26px; font-weight: 600; letter-spacing: -0.3px;">
                ${title}
              </h2>
              <div style="color: #a0aec0; font-size: 16px; line-height: 1.8;">
                ${content}
              </div>
              
              ${buttonText && buttonUrl ? `
              <div style="text-align: center; margin: 36px 0 16px;">
                <a href="${buttonUrl}" 
                   style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px; box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset; transition: all 0.3s;">
                  ${buttonText}
                </a>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);"></div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 14px;">
                    <p style="margin: 0 0 4px; color: #a0aec0;">
                      С уважением,
                    </p>
                    <p style="margin: 0; color: #ffffff; font-weight: 600; font-size: 15px;">
                      Команда MYCSC
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <a href="https://adskoekoleso.ru" style="display: inline-block; padding: 10px 20px; background: rgba(102, 126, 234, 0.15); color: #89b4fa; text-decoration: none; font-size: 13px; font-weight: 500; border-radius: 8px; border: 1px solid rgba(102, 126, 234, 0.3);">
                      adskoekoleso.ru
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Copyright -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05);">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                © 2026 MYCSC Database
              </p>
              <p style="margin: 8px 0 0; color: #4a5568; font-size: 11px;">
                Это автоматическое сообщение
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
export async function sendVerificationEmail(
  email: string, 
  username: string, 
  verificationCode: string,
  verificationUrl: string
): Promise<boolean> {
  const content = `
    <p style="color: #e2e8f0;">Здравствуйте, <strong style="color: #ffffff;">${username}</strong>!</p>
    <p style="color: #a0aec0;">Спасибо за регистрацию в MYCSC Database. Для завершения регистрации подтвердите ваш email адрес.</p>
    <p style="color: #e2e8f0; margin-top: 24px;">Ваш код подтверждения:</p>
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 16px; text-align: center; margin: 20px 0; box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);">
      <span style="font-size: 36px; font-weight: 700; color: white; letter-spacing: 10px; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">${verificationCode}</span>
    </div>
    <p style="color: #64748b; font-size: 13px; text-align: center;">Код действителен 24 часа</p>
    <p style="color: #a0aec0; margin-top: 24px;">Или нажмите кнопку для автоматического подтверждения:</p>
  `;

  const html = createEmailTemplate(
    'Подтвердите ваш Email',
    content,
    'Подтвердить Email',
    verificationUrl
  );

  try {
    await transporter.sendMail({
      from: '"MYCSC Database" <mycsc@mail.ru>',
      to: email,
      subject: 'Подтверждение регистрации в MYCSC Database',
      html
    });
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}
export async function sendWelcomeEmail(email: string, username: string): Promise<boolean> {
  const content = `
    <p style="color: #e2e8f0; font-size: 18px;">Добро пожаловать, <strong style="color: #ffffff;">${username}</strong>!</p>
    <p style="color: #a0aec0;">Ваш аккаунт успешно создан и подтверждён. Теперь вы можете использовать все возможности MYCSC Database:</p>
    <div style="background: rgba(102, 126, 234, 0.1); border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid rgba(102, 126, 234, 0.2);">
      <div style="display: flex; align-items: center; margin: 12px 0; color: #e2e8f0;">
        <span style="color: #89b4fa; margin-right: 12px;">●</span> Создавать и управлять базами данных
      </div>
      <div style="display: flex; align-items: center; margin: 12px 0; color: #e2e8f0;">
        <span style="color: #89b4fa; margin-right: 12px;">●</span> Приглашать коллег для совместной работы
      </div>
      <div style="display: flex; align-items: center; margin: 12px 0; color: #e2e8f0;">
        <span style="color: #89b4fa; margin-right: 12px;">●</span> Синхронизировать данные в реальном времени
      </div>
      <div style="display: flex; align-items: center; margin: 12px 0; color: #e2e8f0;">
        <span style="color: #89b4fa; margin-right: 12px;">●</span> Работать с любого устройства
      </div>
    </div>
    <p style="color: #a0aec0;">Начните прямо сейчас!</p>
  `;

  const html = createEmailTemplate(
    'Добро пожаловать в MYCSC!',
    content,
    'Перейти в приложение',
    'https://adskoekoleso.ru'
  );

  try {
    await transporter.sendMail({
      from: '"MYCSC Database" <mycsc@mail.ru>',
      to: email,
      subject: 'Добро пожаловать в MYCSC Database!',
      html
    });
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
}
export async function sendPasswordResetEmail(
  email: string, 
  username: string, 
  resetCode: string,
  resetUrl: string
): Promise<boolean> {
  const content = `
    <p style="color: #e2e8f0;">Здравствуйте, <strong style="color: #ffffff;">${username}</strong>!</p>
    <p style="color: #a0aec0;">Мы получили запрос на сброс пароля для вашего аккаунта. Если это были не вы, проигнорируйте это письмо.</p>
    <p style="color: #e2e8f0; margin-top: 24px;">Ваш код для сброса пароля:</p>
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 16px; text-align: center; margin: 20px 0; box-shadow: 0 8px 32px rgba(245, 158, 11, 0.3);">
      <span style="font-size: 36px; font-weight: 700; color: white; letter-spacing: 10px; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">${resetCode}</span>
    </div>
    <p style="color: #64748b; font-size: 13px; text-align: center;">Код действителен 1 час</p>
    <p style="color: #a0aec0; margin-top: 24px;">Или нажмите кнопку для сброса пароля:</p>
  `;

  const html = createEmailTemplate(
    'Сброс пароля',
    content,
    'Сбросить пароль',
    resetUrl
  );

  try {
    await transporter.sendMail({
      from: '"MYCSC Database" <mycsc@mail.ru>',
      to: email,
      subject: 'Сброс пароля MYCSC Database',
      html
    });
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}
export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  databaseName: string,
  role: string,
  inviteUrl: string
): Promise<boolean> {
  const roleName = {
    'admin': 'Администратор',
    'mod': 'Модератор', 
    'member': 'Участник'
  }[role] || 'Участник';

  const content = `
    <p style="color: #e2e8f0;">Здравствуйте!</p>
    <p style="color: #a0aec0;"><strong style="color: #ffffff;">${inviterName}</strong> приглашает вас присоединиться к совместной базе данных:</p>
    <div style="background: rgba(102, 126, 234, 0.1); padding: 24px; border-radius: 16px; margin: 24px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #ffffff;">
        ${databaseName}
      </p>
      <p style="margin: 0; color: #a0aec0;">
        Ваша роль: <span style="color: #89b4fa; font-weight: 600;">${roleName}</span>
      </p>
    </div>
    <p style="color: #a0aec0;">Примите приглашение, чтобы начать совместную работу!</p>
  `;

  const html = createEmailTemplate(
    'Приглашение в базу данных',
    content,
    'Принять приглашение',
    inviteUrl
  );

  try {
    await transporter.sendMail({
      from: '"MYCSC Database" <mycsc@mail.ru>',
      to: email,
      subject: `${inviterName} приглашает вас в "${databaseName}"`,
      html
    });
    return true;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return false;
  }
}
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('Email service connected successfully');
    return true;
  } catch (error) {
    console.error('Email service connection failed:', error);
    return false;
  }
}

export default {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  verifyEmailConnection
};
