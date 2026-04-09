export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import {
  buildC2BUrls,
  getDarajaBaseUrl,
  getMpesaAccessToken,
  getMpesaConfig,
} from "@/lib/mpesa/daraja";

export const POST = withPermission("finance", "update", async () => {
  const config = getMpesaConfig();

  if (!config.consumerKey || !config.consumerSecret || !config.shortCode) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Missing MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, or MPESA_SHORTCODE",
      },
      { status: 400 },
    );
  }

  let urls;
  try {
    urls = buildC2BUrls(config);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Missing callback URL" },
      { status: 400 },
    );
  }

  const token = await getMpesaAccessToken(config);

  const response = await fetch(
    `${getDarajaBaseUrl(config.env)}/mpesa/c2b/v1/registerurl`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ShortCode: config.shortCode,
        ResponseType: config.responseType,
        ConfirmationURL: urls.confirmationUrl,
        ValidationURL: urls.validationUrl,
      }),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    return NextResponse.json(
      {
        success: false,
        message: `M-Pesa registration failed: ${response.status}`,
        details: text,
      },
      { status: 500 },
    );
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  return NextResponse.json({
    success: true,
    message: "C2B URLs registered",
    data: parsed,
    urls,
  });
});
