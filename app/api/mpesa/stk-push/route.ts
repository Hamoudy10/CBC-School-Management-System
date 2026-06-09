export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { z } from 'zod';
import { getMpesaConfig, getMpesaAccessToken, getDarajaBaseUrl } from '@/lib/mpesa/daraja';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const stkPushSchema = z.object({
  phone: z.string().min(10).max(15),
  amount: z.number().positive(),
  studentFeeId: z.string().uuid(),
  accountReference: z.string().max(12),
  transactionDesc: z.string().max(50).default('School Fee Payment'),
});

export const POST = withPermission('finance', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, stkPushSchema);
  if (!validation.success) return validationErrorResponse(validation.errors!);

  const supabase = await createSupabaseServerClient();
  const config = getMpesaConfig();
  const token = await getMpesaAccessToken(config);

  const phone = validation.data!.phone.replace(/^0+/, '254').replace(/^\+/, '');
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const passkey = process.env.MPESA_PASSKEY || '';
  const password = Buffer.from(`${config.shortCode}${passkey}${timestamp}`).toString('base64');

  const url = `${getDarajaBaseUrl(config.env)}/mpesa/stkpush/v1/processrequest`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: config.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: validation.data!.amount,
        PartyA: phone,
        PartyB: config.shortCode,
        PhoneNumber: phone,
        CallBackURL: `${config.callbackBaseUrl.replace(/\/$/, '')}/api/mpesa/c2b/confirmation`,
        AccountReference: validation.data!.accountReference,
        TransactionDesc: validation.data!.transactionDesc,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.errorMessage || 'STK push failed');

    await supabase.from('mpesa_stk_requests').insert({
      school_id: user.schoolId!,
      user_id: user.id,
      student_fee_id: validation.data!.studentFeeId,
      phone,
      amount: validation.data!.amount,
      merchant_request_id: result.MerchantRequestID,
      checkout_request_id: result.CheckoutRequestID,
      response_code: result.ResponseCode,
      response_description: result.ResponseDescription,
    });

    return successResponse({
      merchantRequestId: result.MerchantRequestID,
      checkoutRequestId: result.CheckoutRequestID,
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      customerMessage: result.CustomerMessage,
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'STK push failed', 500);
  }
});
