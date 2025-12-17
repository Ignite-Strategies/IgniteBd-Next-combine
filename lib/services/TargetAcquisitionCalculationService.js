/**
 * TargetAcquisitionCalculationService
 * Handles all target acquisition calculation logic for the Target Acquisition Stack module
 */

class TargetAcquisitionCalculationService {
  /**
   * Calculate target acquisition metrics based on input data
   * @param {Object} inputs - Target acquisition input data
   * @param {number} inputs.previousRevenue - Previous year revenue
   * @param {number} inputs.targetRevenue - Target revenue for the period
   * @param {number} inputs.avgUnitValue - Average unit value from revenue stack
   * @param {number} inputs.avgUnitsPerCustomer - Average units per customer from revenue stack
   * @param {number} inputs.timeHorizon - Time horizon in months
   * @returns {Object} Calculated target acquisition metrics
   */
  static calculateTargetAcquisition(inputs) {
    const {
      previousRevenue,
      targetRevenue,
      avgUnitValue,
      avgUnitsPerCustomer,
      timeHorizon = 12
    } = inputs;

    // Validate inputs
    if (!previousRevenue || !targetRevenue || !avgUnitValue || !avgUnitsPerCustomer) {
      throw new Error('Missing required fields: previousRevenue, targetRevenue, avgUnitValue, avgUnitsPerCustomer');
    }

    // Convert to numbers for calculations
    const previous = parseFloat(previousRevenue);
    const target = parseFloat(targetRevenue);
    const unitValue = parseFloat(avgUnitValue);
    const unitsPerCustomer = parseFloat(avgUnitsPerCustomer);
    const horizon = parseInt(timeHorizon);

    // Validate numeric inputs
    if (isNaN(previous) || isNaN(target) || isNaN(unitValue) || isNaN(unitsPerCustomer)) {
      throw new Error('Invalid numeric inputs for target acquisition calculation');
    }

    if (previous <= 0 || target <= 0 || unitValue <= 0 || unitsPerCustomer <= 0) {
      throw new Error('Target acquisition inputs must be positive numbers');
    }

    // Core calculations
    const increaseNeeded = target - previous;
    const growthPercent = (increaseNeeded / previous) * 100;
    const newUnitsNeeded = increaseNeeded / unitValue;
    const newCustomersNeeded = newUnitsNeeded / unitsPerCustomer;
    const monthlyTarget = target / horizon;
    const monthlyIncrease = increaseNeeded / horizon;

    return {
      previousRevenue: previous,
      targetRevenue: target,
      increaseNeeded,
      growthPercent,
      newUnitsNeeded,
      newCustomersNeeded,
      monthlyTarget,
      monthlyIncrease,
      timeHorizon: horizon,
      avgUnitValue: unitValue,
      avgUnitsPerCustomer: unitsPerCustomer
    };
  }

  /**
   * Calculate acquisition velocity requirements
   * @param {Object} targetData - Target acquisition data
   * @returns {Object} Velocity requirements
   */
  static calculateAcquisitionVelocity(targetData) {
    const { newCustomersNeeded, newUnitsNeeded, timeHorizon } = targetData;
    
    const customersPerMonth = newCustomersNeeded / timeHorizon;
    const unitsPerMonth = newUnitsNeeded / timeHorizon;
    const customersPerWeek = customersPerMonth / 4.33; // Average weeks per month
    const unitsPerWeek = unitsPerMonth / 4.33;

    return {
      customersPerMonth,
      unitsPerMonth,
      customersPerWeek,
      unitsPerWeek,
      dailyCustomers: customersPerWeek / 7,
      dailyUnits: unitsPerWeek / 7
    };
  }

  /**
   * Calculate growth scenarios
   * @param {Object} targetData - Target acquisition data
   * @param {Array} scenarios - Array of growth scenarios (e.g., [0.1, 0.2, 0.3] for 10%, 20%, 30%)
   * @returns {Object} Growth scenarios
   */
  static calculateGrowthScenarios(targetData, scenarios = [0.1, 0.2, 0.3, 0.5, 1.0]) {
    const { previousRevenue, timeHorizon } = targetData;
    
    return scenarios.map(scenario => {
      const targetRevenue = previousRevenue * (1 + scenario);
      const increaseNeeded = targetRevenue - previousRevenue;
      const growthPercent = scenario * 100;
      const newUnitsNeeded = increaseNeeded / targetData.avgUnitValue;
      const newCustomersNeeded = newUnitsNeeded / targetData.avgUnitsPerCustomer;
      
      return {
        scenario,
        growthPercent,
        targetRevenue,
        increaseNeeded,
        newUnitsNeeded,
        newCustomersNeeded,
        monthlyTarget: targetRevenue / timeHorizon,
        monthlyIncrease: increaseNeeded / timeHorizon
      };
    });
  }

  /**
   * Calculate acquisition feasibility
   * @param {Object} targetData - Target acquisition data
   * @param {Object} humanCapitalData - Human capital data (optional)
   * @returns {Object} Feasibility analysis
   */
  static calculateAcquisitionFeasibility(targetData, humanCapitalData = null) {
    const { newCustomersNeeded, newUnitsNeeded, timeHorizon } = targetData;
    
    const feasibility = {
      isFeasible: true,
      warnings: [],
      recommendations: []
    };

    // High growth warning
    if (targetData.growthPercent > 100) {
      feasibility.warnings.push('Extremely aggressive growth target (>100%)');
      feasibility.recommendations.push('Consider extending timeline or reducing target');
    } else if (targetData.growthPercent > 50) {
      feasibility.warnings.push('Aggressive growth target (>50%)');
      feasibility.recommendations.push('Ensure adequate resources and systems in place');
    }

    // Customer acquisition rate analysis
    const customersPerMonth = newCustomersNeeded / timeHorizon;
    if (customersPerMonth > 50) {
      feasibility.warnings.push('High customer acquisition rate required');
      feasibility.recommendations.push('Consider scaling marketing and sales efforts');
    }

    // Human capital integration
    if (humanCapitalData) {
      const { totalCapacity, utilization } = humanCapitalData;
      if (utilization > 80) {
        feasibility.warnings.push('Team already at high capacity');
        feasibility.recommendations.push('Consider hiring or reducing scope');
        feasibility.isFeasible = false;
      }
    }

    return feasibility;
  }

  /**
   * Generate acquisition insights
   * @param {Object} targetData - Target acquisition data
   * @returns {Object} Insights and recommendations
   */
  static generateAcquisitionInsights(targetData) {
    const { growthPercent, newCustomersNeeded, newUnitsNeeded, timeHorizon } = targetData;
    
    const insights = [];
    const recommendations = [];

    // Growth scale insights
    if (growthPercent <= 10) {
      insights.push("Conservative growth target - achievable with current operations");
      recommendations.push("Focus on efficiency improvements and customer retention");
    } else if (growthPercent <= 25) {
      insights.push("Moderate growth target - requires some operational scaling");
      recommendations.push("Plan for incremental team growth and process improvements");
    } else if (growthPercent <= 50) {
      insights.push("Aggressive growth target - significant operational changes needed");
      recommendations.push("Consider major hiring, system upgrades, and process automation");
    } else {
      insights.push("Extremely aggressive growth target - fundamental business transformation required");
      recommendations.push("Evaluate market opportunity, competitive positioning, and resource requirements");
    }

    // Customer acquisition insights
    const customersPerMonth = newCustomersNeeded / timeHorizon;
    if (customersPerMonth <= 5) {
      insights.push("Low customer acquisition rate - focus on quality over quantity");
    } else if (customersPerMonth <= 20) {
      insights.push("Moderate customer acquisition rate - standard sales process should work");
    } else {
      insights.push("High customer acquisition rate - requires systematic lead generation");
      recommendations.push("Implement scalable marketing and sales systems");
    }

    return {
      insights,
      recommendations,
      growthScale: this.categorizeGrowthScale(growthPercent),
      acquisitionIntensity: this.categorizeAcquisitionIntensity(customersPerMonth)
    };
  }

  /**
   * Categorize growth scale
   * @param {number} growthPercent - Growth percentage
   * @returns {string} Growth scale category
   */
  static categorizeGrowthScale(growthPercent) {
    if (growthPercent <= 10) return "conservative";
    if (growthPercent <= 25) return "moderate";
    if (growthPercent <= 50) return "aggressive";
    if (growthPercent <= 100) return "very-aggressive";
    return "extreme";
  }

  /**
   * Categorize acquisition intensity
   * @param {number} customersPerMonth - Customers needed per month
   * @returns {string} Acquisition intensity category
   */
  static categorizeAcquisitionIntensity(customersPerMonth) {
    if (customersPerMonth <= 5) return "low";
    if (customersPerMonth <= 20) return "moderate";
    if (customersPerMonth <= 50) return "high";
    return "very-high";
  }

  /**
   * Calculate milestone tracking
   * @param {Object} targetData - Target acquisition data
   * @returns {Object} Milestone tracking data
   */
  static calculateMilestoneTracking(targetData) {
    const { targetRevenue, increaseNeeded, timeHorizon } = targetData;
    const milestones = [];
    
    // Quarterly milestones
    for (let quarter = 1; quarter <= Math.ceil(timeHorizon / 3); quarter++) {
      const quarterProgress = (quarter * 3) / timeHorizon;
      const quarterRevenue = targetRevenue * quarterProgress;
      const quarterIncrease = increaseNeeded * quarterProgress;
      
      milestones.push({
        quarter,
        targetRevenue: quarterRevenue,
        targetIncrease: quarterIncrease,
        progressPercent: quarterProgress * 100
      });
    }

    return {
      milestones,
      monthlyTarget: targetRevenue / timeHorizon,
      quarterlyTarget: targetRevenue / Math.ceil(timeHorizon / 3)
    };
  }
}

export default TargetAcquisitionCalculationService;
