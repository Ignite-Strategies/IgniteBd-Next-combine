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
  READ_BUT_NO_MONEY: 'READ_BUT_NO_MONEY',
  MONEY_AND_READY: 'MONEY_AND_READY'
};

export const BUYING_READINESS_LABELS = {
  [BUYING_READINESS_TYPES.READ_BUT_NO_MONEY]: 'Read but No Money',
  [BUYING_READINESS_TYPES.MONEY_AND_READY]: 'Money and Ready'
};

export default BUYER_PERSON_TYPES;
