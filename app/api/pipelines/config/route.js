import { NextResponse } from 'next/server';
import { getPipelineConfig } from '@/lib/config/pipelineConfig.js';
import { BUYER_PERSON_TYPES, BUYER_PERSON_LABELS, BUYING_READINESS_TYPES, BUYING_READINESS_LABELS } from '@/lib/buyerConfig.js';
import { HOW_MET_TYPES, HOW_MET_LABELS } from '@/lib/config/howMetConfig.js';

export async function GET() {
  try {
    const config = getPipelineConfig();

    return NextResponse.json({
      success: true,
      pipelines: config.pipelines,
      officialPipelines: config.officialPipelines,
      allStages: config.allStages,
      buyerPerson: {
        types: BUYER_PERSON_TYPES,
        labels: BUYER_PERSON_LABELS,
      },
      buyingReadiness: {
        types: BUYING_READINESS_TYPES,
        labels: BUYING_READINESS_LABELS,
      },
      howMet: {
        types: HOW_MET_TYPES,
        labels: HOW_MET_LABELS,
      },
    });
  } catch (error) {
    console.error('Error getting pipeline config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get pipeline configuration',
      },
      { status: 500 },
    );
  }
}

