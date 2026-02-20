import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import RetainerLoading from "./loading";
import { createRetainerCheckoutSession } from "@/lib/stripe/retainerCheckout";

const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.ignitegrowth.biz";

export default async function RetainerPage({ params }) {
  const { companySlug, part } = await params;
  if (!companySlug?.trim() || !part?.trim()) {
    notFound();
  }
  const slug = `${companySlug.trim()}/${part.trim()}`;

  return (
    <Suspense fallback={<RetainerLoading />}>
      <RetainerPageContent slug={slug} />
    </Suspense>
  );
}

async function RetainerPageContent({ slug }) {
  const retainer = await prisma.company_retainers.findUnique({
    where: { slug },
    include: {
      company_hqs: {
        select: {
          id: true,
          companyName: true,
          stripeCustomerId: true,
        },
      },
    },
  });

  if (!retainer) {
    notFound();
  }

  if (!["LINK_SENT", "ACTIVE", "PAST_DUE"].includes(retainer.status)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Retainer unavailable</h1>
          <p className="text-sm text-gray-600">This retainer is not available for payment.</p>
        </div>
      </div>
    );
  }

  let checkoutUrl = null;
  if (retainer.company_hqs) {
    try {
      const session = await createRetainerCheckoutSession({
        retainer: {
          id: retainer.id,
          name: retainer.name,
          description: retainer.description,
          amountCents: retainer.amountCents,
          currency: retainer.currency,
          startDate: retainer.startDate,
        },
        company: {
          id: retainer.company_hqs.id,
          companyName: retainer.company_hqs.companyName,
          stripeCustomerId: retainer.company_hqs.stripeCustomerId,
        },
        successUrl: `${APP_DOMAIN}/retainer-paid`,
        cancelUrl: `${APP_DOMAIN}/retainer-canceled`,
      });
      checkoutUrl = session.url;
    } catch (error) {
      console.error("❌ Retainer checkout session error:", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{retainer.name}</h1>
        <p className="text-sm text-gray-600 mb-6">
          Monthly retainer for {retainer.company_hqs?.companyName || "your company"}
        </p>

        {retainer.description && (
          <p className="text-sm text-gray-700 mb-6">{retainer.description}</p>
        )}

        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="text-sm text-gray-600">Amount</div>
          <div className="text-2xl font-semibold text-gray-900">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: (retainer.currency || "usd").toUpperCase(),
            }).format(retainer.amountCents / 100)}
            <span className="text-base font-medium text-gray-600"> / month</span>
          </div>
          {retainer.startDate && (
            <div className="mt-2 text-xs text-gray-500">
              Starts on {new Date(retainer.startDate).toLocaleDateString()}
            </div>
          )}
        </div>

        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Continue to secure payment
          </a>
        ) : (
          <div className="text-sm text-red-600">
            We could not start checkout right now. Please try again in a moment.
          </div>
        )}
      </div>
    </div>
  );
}
