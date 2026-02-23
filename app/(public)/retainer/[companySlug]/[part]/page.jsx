import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import RetainerLoading from "./loading";
import { createRetainerCheckoutSession } from "@/lib/stripe/retainerCheckout";
import RetainerContainer from "@/components/retainer/RetainerContainer";

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
          companyStreet: true,
          companyCity: true,
          companyState: true,
          companyZip: true,
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
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <RetainerContainer
        retainer={{
          id: retainer.id,
          name: retainer.name,
          description: retainer.description,
          amountCents: retainer.amountCents,
          currency: retainer.currency,
          startDate: retainer.startDate,
        }}
        checkoutUrl={checkoutUrl}
        companyName={retainer.company_hqs?.companyName}
        companyAddress={
          retainer.company_hqs
            ? {
                street: retainer.company_hqs.companyStreet,
                city: retainer.company_hqs.companyCity,
                state: retainer.company_hqs.companyState,
                zip: retainer.company_hqs.companyZip,
              }
            : undefined
        }
      />
    </div>
  );
}
