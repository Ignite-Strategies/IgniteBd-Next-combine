/**
 * Template Test Text Utility
 * 
 * Provides realistic test data for template previews
 * Generates varied, realistic sample data to help users see how their templates will look
 */

// Realistic first names pool
const FIRST_NAMES = [
  'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'James', 'Ashley', 'Robert',
  'Amanda', 'Christopher', 'Melissa', 'Daniel', 'Michelle', 'Matthew', 'Nicole',
  'Joshua', 'Stephanie', 'Andrew', 'Lauren', 'Ryan', 'Rachel', 'Kevin', 'Lisa',
  'Brian', 'Jennifer', 'Justin', 'Amy', 'Brandon', 'Angela', 'Jason', 'Rebecca',
  'Eric', 'Samantha', 'Jonathan', 'Kimberly', 'Steven', 'Michelle', 'Thomas',
];

// Realistic last names pool
const LAST_NAMES = [
  'Johnson', 'Smith', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
  'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
  'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
];

// Realistic company names pool
const COMPANY_NAMES = [
  'TechCorp', 'Innovate Solutions', 'Digital Dynamics', 'Cloud Ventures', 'Data Systems Inc',
  'NextGen Technologies', 'FutureWorks', 'Synergy Partners', 'Apex Consulting', 'Prime Solutions',
  'Elite Enterprises', 'Summit Group', 'Catalyst Labs', 'Momentum Industries', 'Vertex Systems',
  'Nexus Corporation', 'Pinnacle Technologies', 'Stellar Solutions', 'Quantum Dynamics', 'Fusion Labs',
];

// Realistic job titles pool
const JOB_TITLES = [
  'VP of Engineering', 'Director of Product', 'Senior Manager', 'Head of Operations',
  'Chief Technology Officer', 'VP of Sales', 'Director of Marketing', 'Senior Engineer',
  'Product Manager', 'Operations Manager', 'Business Development Lead', 'Marketing Director',
  'Engineering Manager', 'Sales Director', 'Chief Operating Officer', 'VP of Strategy',
  'Head of Product', 'Senior Director', 'Principal Engineer', 'VP of Business Development',
];

// Realistic business names pool
const BUSINESS_NAMES = [
  'Ignite Growth Partners', 'Strategic Solutions Group', 'Innovation Labs', 'Growth Catalyst',
  'The NDA House', 'Consulting Collective', 'Strategic Advisors', 'Business Builders',
  'Growth Partners', 'Innovation Partners', 'Strategic Ventures', 'Business Solutions',
];

// Realistic role names pool
const ROLE_NAMES = [
  'Joel', 'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery',
  'Quinn', 'Sage', 'Drew', 'Blake', 'Cameron', 'Dakota', 'Finley', 'Hayden',
];

// Time horizons pool
const TIME_HORIZONS = [
  '2026', 'Q1 2026', 'early next year', 'next quarter', 'soon', 'this fall',
  'next month', 'in the coming weeks', 'later this year', 'Q2 2026',
];

// Desired outcomes pool
const DESIRED_OUTCOMES = [
  'see if we can collaborate', 'catch up over coffee', 'explore partnership opportunities',
  'discuss potential collaboration', 'reconnect and see how things are going',
  'see if there are ways we can work together', 'grab coffee and catch up',
  'explore ways to collaborate', 'discuss potential opportunities',
];

/**
 * Get a random item from an array
 */
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate realistic test contact data
 * @param {Object} options - Options for generating test data
 * @param {string} options.typeOfPerson - Type of person (affects title/company selection)
 * @returns {Object} Test contact data
 */
export function generateTestContactData(options = {}) {
  const { typeOfPerson } = options;
  
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const companyName = randomItem(COMPANY_NAMES);
  const title = randomItem(JOB_TITLES);
  
  // Generate a realistic last contact date (1-3 years ago)
  const yearsAgo = 1 + Math.random() * 2; // 1-3 years
  const lastContactDate = new Date();
  lastContactDate.setFullYear(lastContactDate.getFullYear() - Math.floor(yearsAgo));
  lastContactDate.setMonth(Math.floor(Math.random() * 12));
  
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    goesBy: firstName,
    companyName,
    title,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    lastContactDate: lastContactDate.toISOString().split('T')[0],
    updatedAt: lastContactDate.toISOString(),
  };
}

/**
 * Generate realistic test metadata
 * @param {Object} options - Options for generating test data
 * @param {string} options.timeHorizon - Optional specific time horizon
 * @param {string} options.desiredOutcome - Optional specific desired outcome
 * @param {string} options.myBusinessName - Optional specific business name
 * @param {boolean} options.knowledgeOfBusiness - Optional knowledge flag
 * @returns {Object} Test metadata
 */
export function generateTestMetadata(options = {}) {
  const {
    timeHorizon,
    desiredOutcome,
    myBusinessName,
    knowledgeOfBusiness,
  } = options;
  
  return {
    timeHorizon: timeHorizon || randomItem(TIME_HORIZONS),
    desiredOutcome: desiredOutcome || randomItem(DESIRED_OUTCOMES),
    myBusinessName: myBusinessName || randomItem(BUSINESS_NAMES),
    myRole: randomItem(ROLE_NAMES),
    knowledgeOfBusiness: knowledgeOfBusiness !== undefined ? knowledgeOfBusiness : Math.random() > 0.5,
  };
}

/**
 * Generate complete test data set for template preview
 * @param {Object} options - Options for generating test data
 * @returns {Object} Complete test data with contactData and metadata
 */
export function generateTestData(options = {}) {
  return {
    contactData: generateTestContactData(options),
    metadata: generateTestMetadata(options),
  };
}

/**
 * Get multiple test data sets (for testing with different contacts)
 * @param {number} count - Number of test sets to generate
 * @param {Object} options - Options for generating test data
 * @returns {Array} Array of test data sets
 */
export function generateMultipleTestDataSets(count = 3, options = {}) {
  const sets = [];
  for (let i = 0; i < count; i++) {
    sets.push(generateTestData(options));
  }
  return sets;
}




