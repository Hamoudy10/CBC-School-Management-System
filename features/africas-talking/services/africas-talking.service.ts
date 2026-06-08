import type { AfricasTalkingConfig, SendSmsParams, SendWhatsAppParams, AfricasTalkingResponse } from '../types';

const AT_SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';
const AT_PRODUCTION_URL = 'https://api.africastalking.com/version1/messaging';

function getConfig(): AfricasTalkingConfig {
  return {
    apiKey: process.env.AT_API_KEY || '',
    username: process.env.AT_USERNAME || 'sandbox',
    senderId: process.env.AT_SENDER_ID || '',
    env: (process.env.AT_ENV as 'sandbox' | 'production') || 'sandbox',
  };
}

function getBaseUrl(env: string): string {
  return env === 'production' ? AT_PRODUCTION_URL : AT_SANDBOX_URL;
}

export async function sendSms(params: SendSmsParams): Promise<AfricasTalkingResponse> {
  const config = getConfig();

  if (!config.apiKey) {
    return { success: false, message: 'AT_API_KEY not configured' };
  }

  const formData = new URLSearchParams();
  formData.append('username', config.username);
  formData.append('to', params.to.join(','));
  formData.append('message', params.message);
  if (params.senderId || config.senderId) {
    formData.append('from', params.senderId || config.senderId);
  }

  try {
    const response = await fetch(getBaseUrl(config.env), {
      method: 'POST',
      headers: {
        'apiKey': config.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok || data.SMSMessageData?.Message?.startsWith('Failed')) {
      return {
        success: false,
        message: data.SMSMessageData?.Message || `HTTP ${response.status}`,
      };
    }

    const recipients = data.SMSMessageData?.Recipients?.map((r: any) => ({
      number: r.number,
      status: r.status,
      cost: r.cost,
    })) || [];

    return {
      success: recipients.some((r: any) => r.status === 'Success'),
      message: `Sent to ${recipients.length} recipient(s)`,
      recipients,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<AfricasTalkingResponse> {
  const config = getConfig();

  if (!config.apiKey) {
    return { success: false, message: 'AT_API_KEY not configured' };
  }

  const whatsAppUrl = `${getBaseUrl(config.env)}/whatsapp`;

  const formData = new URLSearchParams();
  formData.append('username', config.username);
  formData.append('to', params.to.join(','));
  formData.append('message', params.message);

  try {
    const response = await fetch(whatsAppUrl, {
      method: 'POST',
      headers: {
        'apiKey': config.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      message: 'WhatsApp message sent',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send WhatsApp message',
    };
  }
}

export function getAfricasTalkingConfig(): AfricasTalkingConfig {
  return getConfig();
}

export function isAfricasTalkingConfigured(): boolean {
  const config = getConfig();
  return !!(config.apiKey && config.username);
}
