// Persona data management utilities
// Handles loading, saving, and hydrating persona data

const STORAGE_KEY = 'personaData';

/**
 * Load personas from localStorage
 * @returns {Array} Array of persona objects
 */
export const loadPersonas = () => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const data = JSON.parse(savedData);
      return data.personas || [];
    }
  } catch (error) {
    console.error('Error loading personas from localStorage:', error);
  }
  return [];
};

/**
 * Save personas to localStorage
 * @param {Array} personas - Array of persona objects to save
 */
export const savePersonas = (personas) => {
  try {
    const dataToSave = {
      personas,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Error saving personas to localStorage:', error);
  }
};

/**
 * Check if personas exist in storage
 * @returns {boolean}
 */
export const hasPersonas = () => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    return !!savedData;
  } catch (error) {
    return false;
  }
};

/**
 * Hydrate with demo data if no personas exist
 * @param {Array} demoPersonas - Demo persona data to use for hydration
 * @returns {Array} Array of personas (either from storage or demo data)
 */
export const hydratePersonas = (demoPersonas = []) => {
  const existing = loadPersonas();
  if (existing.length > 0) {
    return existing;
  }
  
  // If no existing data, save demo data
  if (demoPersonas.length > 0) {
    savePersonas(demoPersonas);
    return demoPersonas;
  }
  
  return [];
};

