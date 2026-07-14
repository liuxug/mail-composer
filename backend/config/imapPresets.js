export const IMAP_PRESETS = {
  qq: {
    label: 'QQ邮箱',
    imapHost: 'imap.qq.com',
    imapPort: 993,
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
    requiresAuthCode: true,
    authCodeGuide: '登录QQ邮箱 -> 设置 -> 账户 -> POP3/IMAP服务 -> 开启IMAP/SMTP服务 -> 获取授权码'
  },
  qqex: {
    label: 'QQ企业邮箱',
    imapHost: 'imap.exmail.qq.com',
    imapPort: 993,
    smtpHost: 'smtp.exmail.qq.com',
    smtpPort: 465,
    requiresAuthCode: false,
    authCodeGuide: '使用邮箱密码登录'
  },
  163: {
    label: '网易163邮箱',
    imapHost: 'imap.163.com',
    imapPort: 993,
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
    requiresAuthCode: true,
    authCodeGuide: '登录163邮箱 -> 设置 -> POP3/SMTP/IMAP -> 开启IMAP/SMTP服务 -> 获取授权码'
  },
  126: {
    label: '网易126邮箱',
    imapHost: 'imap.126.com',
    imapPort: 993,
    smtpHost: 'smtp.126.com',
    smtpPort: 465,
    requiresAuthCode: true,
    authCodeGuide: '登录126邮箱 -> 设置 -> POP3/SMTP/IMAP -> 开启IMAP/SMTP服务 -> 获取授权码'
  },
  sina: {
    label: '新浪邮箱',
    imapHost: 'imap.sina.com.cn',
    imapPort: 993,
    smtpHost: 'smtp.sina.com.cn',
    smtpPort: 465,
    requiresAuthCode: true,
    authCodeGuide: '登录新浪邮箱 -> 设置 -> 客户端授权密码 -> 获取授权码'
  },
  gmail: {
    label: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    requiresAuthCode: true,
    authCodeGuide: 'Google账号需要启用"应用专用密码"或使用OAuth2认证。启用两步验证后，在安全设置中创建应用专用密码。',
    oauth2: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'https://mail.google.com/',
      clientId: '',
      clientSecret: ''
    }
  },
  outlook: {
    label: 'Outlook/Hotmail',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    requiresAuthCode: false,
    authCodeGuide: '使用邮箱密码登录。如果启用了双重认证，需要使用应用密码。',
    useStartTls: true
  },
  office365: {
    label: 'Office 365',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    requiresAuthCode: false,
    authCodeGuide: '使用邮箱密码登录。如果启用了双重认证，需要使用应用密码。',
    useStartTls: true
  },
  yahoo: {
    label: 'Yahoo邮箱',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
    requiresAuthCode: true,
    authCodeGuide: '登录Yahoo账号 -> 账户安全 -> 生成应用密码'
  },
  icloud: {
    label: 'iCloud邮箱',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    requiresAuthCode: true,
    authCodeGuide: '登录Apple ID -> 密码与安全性 -> 生成App专用密码',
    useStartTls: true
  },
  custom: {
    label: '自定义邮箱',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 465,
    requiresAuthCode: false,
    authCodeGuide: '请输入邮箱服务器配置信息'
  }
};

export function getPresetByEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) {
    return IMAP_PRESETS.custom;
  }
  
  if (domain.includes('qq.com')) {
    return domain.includes('exmail') ? IMAP_PRESETS.qqex : IMAP_PRESETS.qq;
  }
  
  if (domain === '163.com') {
    return IMAP_PRESETS[163];
  }
  
  if (domain === '126.com') {
    return IMAP_PRESETS[126];
  }
  
  if (domain.includes('sina')) {
    return IMAP_PRESETS.sina;
  }
  
  if (domain === 'gmail.com') {
    return IMAP_PRESETS.gmail;
  }
  
  if (domain.includes('outlook') || domain.includes('hotmail')) {
    return IMAP_PRESETS.outlook;
  }
  
  if (domain.includes('office365') || domain.includes('microsoft') || domain.includes('live')) {
    return IMAP_PRESETS.office365;
  }
  
  if (domain.includes('yahoo')) {
    return IMAP_PRESETS.yahoo;
  }
  
  if (domain.includes('icloud') || domain.includes('me.com')) {
    return IMAP_PRESETS.icloud;
  }
  
  return IMAP_PRESETS.custom;
}

export function getPresetKeys() {
  return Object.keys(IMAP_PRESETS);
}

export function getPresetLabels() {
  return Object.entries(IMAP_PRESETS).map(([key, preset]) => ({
    key,
    label: preset.label
  }));
}