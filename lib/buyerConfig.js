// Buyer Person Configuration
// Defines the buyer person types/categories for contacts
// Values match the BuyerPerson enum in Prisma schema

export const BUYER_PERSON_TYPES = {
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  DIRECTOR_VP: 'DIRECTOR_VP',
  PRODUCT_USER: 'PRODUCT_USER'
};

export const BUYER_PERSON_LABELS = {
  [BUYER_PERSON_TYPES.BUSINESS_OWNER]: 'Business Owner',
  [BUYER_PERSON_TYPES.DIRECTOR_VP]: 'Director/VP',
  [BUYER_PERSON_TYPES.PRODUCT_USER]: 'Product User'
};

// Buying Readiness Configuration
export const BUYING_READINESS_TYPES = {
  NOT_READY: 'NOT_READY',
  READY_NO_MONEY: 'READY_NO_MONEY',
  READY_WITH_MONEY: 'READY_WITH_MONEY'
};

export const BUYING_READINESS_LABELS = {
  [BUYING_READINESS_TYPES.NOT_READY]: 'Not Ready',
  [BUYING_READINESS_TYPES.READY_NO_MONEY]: 'Ready No Money',
  [BUYING_READINESS_TYPES.READY_WITH_MONEY]: 'Ready with Money'
};

export default BUYER_PERSON_TYPES;
