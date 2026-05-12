/**
 * Weekly Next Engagement digest — invoked by Vercel Cron (or any client sending Authorization).
 *
 * Security: set CRON_SECRET in project env. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when configured.
 *
 * Schedule: vercel.json — Monday 14:00 UTC (`0 14 * * 1`; Vercel uses UTC and numeric DOW, Monday=1).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listContactsDue } from '@/lib/services/engagementService';
import { sendEmail } from '@/lib/sendgridClient';
import { formatNextEngagementEmailHtml, formatNextEngagementEmailText } from '@/lib/email/nextEngagementEmailTemplate';
import { loadOwnersTiedToCompany, ownerDisplayName } from '@/lib/services/nextEngagementDigestRecipients';

export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

function cronSecretMissing() {
  return NextResponse.json(
    { success: false, error: 'CRON_SECRET is not set — refuse to run unauthenticated cron.' },
    { status: 503 },
  );
}

function authorizeCron(request: Request): 'ok' | 'missing_env' | 'denied' {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return 'missing_env';
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) return 'denied';
  return 'ok';
}

async function runWeeklyDigest() {
  const companies = await prisma.company_hqs.findMany({
    where: {
      OR: [{ ownerId: { not: null } }, { company_memberships: { some: {} } }],
    },
    select: { id: true, companyName: true },
  });

  let sent = 0;
  let skippedNoVerifiedSender = 0;
  let companiesSkippedNoEngagements = 0;
  const errors: { companyId: string; ownerId?: string; message: string }[] = [];

  for (const company of companies) {
    let nextEngagements;
    try {
      nextEngagements = await listContactsDue(company.id, { limit: 500 });
    } catch (e) {
      errors.push({
        companyId: company.id,
        message: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    if (!nextEngagements.length) {
      companiesSkippedNoEngagements += 1;
      continue;
    }

    const owners = await loadOwnersTiedToCompany(company.id);
    const subject = `Next Engagement Report - ${new Date().toLocaleDateString()}`;
    const html = formatNextEngagementEmailHtml(nextEngagements, undefined);
    const text = formatNextEngagementEmailText(nextEngagements, undefined);

    for (const o of owners) {
      const fromEmail = o.sendgridVerifiedEmail?.trim();
      if (!fromEmail) {
        skippedNoVerifiedSender += 1;
        continue;
      }

      const toEmail = (o.email || o.sendgridVerifiedEmail || '').trim();
      if (!toEmail) {
        skippedNoVerifiedSender += 1;
        continue;
      }

      const toName = ownerDisplayName(o) || toEmail.split('@')[0];

      try {
        await sendEmail({
          to: toEmail,
          toName,
          subject,
          html,
          text,
          from: fromEmail,
          fromName: o.sendgridVerifiedName || undefined,
        });
        sent += 1;
      } catch (e) {
        errors.push({
          companyId: company.id,
          ownerId: o.id,
          message: e instanceof Error ? e.message : String(e),
        });
      }

      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return {
    companiesScanned: companies.length,
    emailsSent: sent,
    skippedNoVerifiedSender,
    companiesSkippedNoEngagements,
    errors,
  };
}

export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (auth === 'missing_env') return cronSecretMissing();
  if (auth === 'denied') return unauthorized();

  try {
    const summary = await runWeeklyDigest();
    return NextResponse.json({ success: true, ...summary });
  } catch (e) {
    console.error('weekly-next-engagement cron:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = authorizeCron(request);
  if (auth === 'missing_env') return cronSecretMissing();
  if (auth === 'denied') return unauthorized();

  try {
    const summary = await runWeeklyDigest();
    return NextResponse.json({ success: true, ...summary });
  } catch (e) {
    console.error('weekly-next-engagement cron:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
