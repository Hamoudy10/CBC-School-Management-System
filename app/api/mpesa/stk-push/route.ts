export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { rateLimit } from '@/lib/api/rateLimit';
import { validateBody } from '@/lib/api/validation';
import { z } from 'zod';
import { randomUUID } from 'crypto';
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
  const rl = rateLimit(`stkpush:${user.id}`, 10, 60);
  if (!rl.allowed) {
    return errorResponse(`Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`, 429);
  }

  const validation = await validateBody(request, stkPushSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const config = getMpesaConfig();
  const token = await getMpesaAccessToken(config);

  const phone = validation.data!.phone.replace(/^0+/, '254').replace(/^\+/, '');
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const passkey = process.env.MPESA_PASSKEY || '';
  const password = Buffer.from(`${config.shortCode}${passkey}${timestamp}`).toString('base64');

  // Validate amount against student fee balance
  const { data: studentFee } = await supabase
    .from("student_fees")
    .select("amount_due, amount_paid, balance, status, school_id")
    .eq("id", validation.data!.studentFeeId)
    .single();

  if (!studentFee) {
    return errorResponse("Student fee record not found.", 404);
  }

  const amountDue = Number((studentFee as any).amount_due || 0);
  const amountPaid = Number((studentFee as any).amount_paid || 0);
  const balance = Math.max(amountDue - amountPaid, 0);

  if ((studentFee as any).status === "waived") {
    return errorResponse("STK Push is blocked for waived fees.", 400);
  }

  if (validation.data!.amount > balance) {
    return errorResponse(
      `Amount (${validation.data!.amount}) exceeds outstanding balance (${balance}).`,
      400,
    );
  }

  // Check for existing pending STK Push for the same student fee
  const { data: pendingPush } = await supabase
    .from("mpesa_stk_requests")
    .select("id")
    .eq("student_fee_id", validation.data!.studentFeeId)
    .eq("response_code", "0")
    .is("checkout_request_id", null)
    .maybeSingle();

  if (pendingPush) {
    return errorResponse("A pending STK Push already exists for this fee. Please wait for it to complete.", 409);
  }

  const idempotencyKey = randomUUID();
  const url = `${getDarajaBaseUrl(config.env)}/mpesa/stkpush/v1/processrequest`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
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
    if (!response.ok) {throw new Error(result.errorMessage || 'STK push failed');}

    await supabase.from('mpesa_stk_requests').insert({
      school_id: (studentFee as any).school_id,
      user_id: user.id,
      student_fee_id: validation.data!.studentFeeId,
      phone,
      amount: validation.data!.amount,
      merchant_request_id: result.MerchantRequestID,
      checkout_request_id: result.CheckoutRequestID,
      response_code: result.ResponseCode,
      response_description: result.ResponseDescription,
      idempotency_key: idempotencyKey,
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
