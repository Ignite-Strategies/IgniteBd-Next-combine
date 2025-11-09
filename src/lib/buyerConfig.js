// Buyer Decision Maker Configuration
// Defines the buyer decision maker types/categories for contacts

export const BUYER_TYPES = {
  SENIOR_PERSON: 'senior-person',
  PRODUCT_USER: 'product-user',
  HAS_MONEY: 'has-money'
};

export const BUYER_LABELS = {
  [BUYER_TYPES.SENIOR_PERSON]: 'Senior Person',
  [BUYER_TYPES.PRODUCT_USER]: 'Product User',
  [BUYER_TYPES.HAS_MONEY]: 'Has Money'
};

export default BUYER_TYPES;
