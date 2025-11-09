/**
 * HumanCapitalCalculationService
 * Handles all human capital calculation logic for the Human Capital Stack module
 */

class HumanCapitalCalculationService {
  /**
   * Calculate human capital metrics based on input data
   * @param {Object} inputs - Human capital input data
   * @param {number} inputs.totalTeamMembers - Total team members
   * @param {number} inputs.avgHoursPerWeek - Average hours per week per team member
   * @param {number} inputs.founderHoursPerWeek - Founder hours per week (optional)
   * @param {number} inputs.hoursPerUnit - Hours required per unit/project
   * @param {number} inputs.totalUnitsPerMonth - Total units required per month
   * @param {number} inputs.contractorHours - Contractor hours per month (optional)
   * @returns {Object} Calculated human capital metrics
   */
  static calculateHumanCapital(inputs) {
    const {
      totalTeamMembers,
      avgHoursPerWeek,
      founderHoursPerWeek = 0,
      hoursPerUnit,
      totalUnitsPerMonth,
      contractorHours = 0
    } = inputs;

    // Validate inputs
    if (!totalTeamMembers || !avgHoursPerWeek || !hoursPerUnit || !totalUnitsPerMonth) {
      throw new Error('Missing required fields: totalTeamMembers, avgHoursPerWeek, hoursPerUnit, totalUnitsPerMonth');
    }

    // Convert to numbers for calculations
    const teamMembers = parseInt(totalTeamMembers);
    const avgHours = parseFloat(avgHoursPerWeek);
    const founderHours = parseFloat(founderHoursPerWeek) || 0;
    const hoursPer = parseFloat(hoursPerUnit);
    const unitsPerMonth = parseInt(totalUnitsPerMonth);
    const contractor = parseFloat(contractorHours) || 0;

    // Validate numeric inputs
    if (isNaN(teamMembers) || isNaN(avgHours) || isNaN(hoursPer) || isNaN(unitsPerMonth)) {
      throw new Error('Invalid numeric inputs for human capital calculation');
    }

    if (teamMembers <= 0 || avgHours <= 0 || hoursPer <= 0 || unitsPerMonth <= 0) {
      throw new Error('Human capital inputs must be positive numbers');
    }

    // Core calculations
    const totalNeededHours = hoursPer * unitsPerMonth;
    const teamCapacity = teamMembers * avgHours * 4; // 4 weeks per month
    const founderCapacity = founderHours * 4;
    const contractorCapacity = contractor;
    const totalCapacity = teamCapacity + founderCapacity + contractorCapacity;
    const delta = totalCapacity - totalNeededHours;
    const utilization = totalCapacity > 0 ? (totalNeededHours / totalCapacity) * 100 : 0;

    return {
      totalTeamMembers: teamMembers,
      avgHoursPerWeek: avgHours,
      founderHoursPerWeek: founderHours,
      hoursPerUnit: hoursPer,
      totalUnitsPerMonth: unitsPerMonth,
      contractorHours: contractor,
      totalNeededHours,
      teamCapacity,
      totalCapacity,
      delta,
      utilization
    };
  }

  /**
   * Calculate capacity recommendations
   * @param {Object} humanCapitalData - Human capital data
   * @returns {Object} Capacity recommendations
   */
  static calculateCapacityRecommendations(humanCapitalData) {
    const { totalNeededHours, totalCapacity, utilization, avgHoursPerWeek, totalTeamMembers } = humanCapitalData;
    
    const recommendations = [];
    const warnings = [];

    // Utilization analysis
    if (utilization > 100) {
      const overloadHours = totalNeededHours - totalCapacity;
      const neededMembers = Math.ceil(overloadHours / (avgHoursPerWeek * 4));
      const reductionPercent = Math.round(((totalNeededHours - totalCapacity) / totalNeededHours) * 100);
      
      recommendations.push(`Add ${neededMembers} team member(s) to handle current load`);
      recommendations.push(`Or reduce volume by ${reductionPercent}% to match current capacity`);
      warnings.push(`Running at ${utilization.toFixed(1)}% utilization - team is overloaded`);
    } else if (utilization > 80) {
      recommendations.push('Consider adding capacity or optimizing processes');
      warnings.push(`Running at ${utilization.toFixed(1)}% utilization - approaching capacity limits`);
    } else if (utilization < 50) {
      recommendations.push('Consider taking on more work or reducing team size');
      warnings.push(`Running at ${utilization.toFixed(1)}% utilization - significant underutilization`);
    } else {
      recommendations.push('Good capacity utilization - room for growth');
    }

    // Spare capacity analysis
    if (totalCapacity > totalNeededHours) {
      const spareHours = totalCapacity - totalNeededHours;
      const spareMembers = Math.floor(spareHours / (avgHoursPerWeek * 4));
      recommendations.push(`You have ${spareHours.toLocaleString()} hours of spare capacity (${spareMembers} equivalent team members)`);
    }

    return {
      recommendations,
      warnings,
      utilizationStatus: this.getUtilizationStatus(utilization)
    };
  }

  /**
   * Get utilization status
   * @param {number} utilization - Utilization percentage
   * @returns {Object} Utilization status
   */
  static getUtilizationStatus(utilization) {
    if (utilization <= 50) return { status: 'underutilized', color: 'blue', icon: '📉' };
    if (utilization <= 80) return { status: 'optimal', color: 'green', icon: '✅' };
    if (utilization <= 100) return { status: 'warning', color: 'yellow', icon: '⚠️' };
    return { status: 'overload', color: 'red', icon: '🚨' };
  }

  /**
   * Calculate team efficiency metrics
   * @param {Object} humanCapitalData - Human capital data
   * @returns {Object} Efficiency metrics
   */
  static calculateEfficiencyMetrics(humanCapitalData) {
    const { 
      totalTeamMembers, 
      avgHoursPerWeek, 
      totalUnitsPerMonth, 
      hoursPerUnit,
      totalCapacity,
      totalNeededHours 
    } = humanCapitalData;

    const unitsPerTeamMember = totalUnitsPerMonth / totalTeamMembers;
    const hoursPerTeamMember = (totalTeamMembers * avgHoursPerWeek * 4) / totalTeamMembers;
    const efficiency = totalCapacity > 0 ? (totalNeededHours / totalCapacity) * 100 : 0;
    const productivity = totalTeamMembers > 0 ? totalUnitsPerMonth / totalTeamMembers : 0;

    return {
      unitsPerTeamMember,
      hoursPerTeamMember,
      efficiency,
      productivity,
      capacityUtilization: efficiency
    };
  }

  /**
   * Calculate scaling recommendations
   * @param {Object} humanCapitalData - Human capital data
   * @param {number} targetGrowth - Target growth percentage (e.g., 0.25 for 25%)
   * @returns {Object} Scaling recommendations
   */
  static calculateScalingRecommendations(humanCapitalData, targetGrowth = 0.25) {
    const { totalUnitsPerMonth, hoursPerUnit, totalCapacity, avgHoursPerWeek } = humanCapitalData;
    
    const projectedUnits = totalUnitsPerMonth * (1 + targetGrowth);
    const projectedHours = projectedUnits * hoursPerUnit;
    const currentCapacity = totalCapacity;
    const capacityGap = projectedHours - currentCapacity;
    
    const neededTeamMembers = Math.ceil(capacityGap / (avgHoursPerWeek * 4));
    const neededContractorHours = capacityGap;
    
    return {
      currentCapacity,
      projectedHours,
      capacityGap,
      neededTeamMembers,
      neededContractorHours,
      scalingOptions: [
        {
          type: 'hire_team',
          description: `Hire ${neededTeamMembers} additional team members`,
          cost: 'High upfront cost, long-term capacity'
        },
        {
          type: 'contractors',
          description: `Use ${neededContractorHours.toLocaleString()} contractor hours per month`,
          cost: 'Flexible, higher per-hour cost'
        },
        {
          type: 'hybrid',
          description: `Hire ${Math.ceil(neededTeamMembers / 2)} team members + ${Math.ceil(neededContractorHours / 2).toLocaleString()} contractor hours`,
          cost: 'Balanced approach'
        }
      ]
    };
  }

  /**
   * Generate human capital insights
   * @param {Object} humanCapitalData - Human capital data
   * @returns {Object} Insights and recommendations
   */
  static generateHumanCapitalInsights(humanCapitalData) {
    const { utilization, totalTeamMembers, totalUnitsPerMonth, hoursPerUnit } = humanCapitalData;
    
    const insights = [];
    const recommendations = [];

    // Team size insights
    if (totalTeamMembers < 3) {
      insights.push("Small team - focus on efficiency and clear role definitions");
      recommendations.push("Consider documenting processes and creating standard operating procedures");
    } else if (totalTeamMembers < 10) {
      insights.push("Growing team - focus on communication and coordination");
      recommendations.push("Consider implementing project management tools and regular team meetings");
    } else {
      insights.push("Large team - focus on management structure and delegation");
      recommendations.push("Consider implementing team leads and clear reporting structures");
    }

    // Utilization insights
    if (utilization > 100) {
      insights.push("Team is overloaded - immediate action needed");
      recommendations.push("Prioritize hiring or reducing workload");
    } else if (utilization > 80) {
      insights.push("Team is at capacity - plan for growth");
      recommendations.push("Start planning for team expansion or process optimization");
    } else if (utilization < 50) {
      insights.push("Team has significant spare capacity");
      recommendations.push("Consider taking on more work or optimizing team size");
    }

    // Productivity insights
    const unitsPerPerson = totalUnitsPerMonth / totalTeamMembers;
    if (unitsPerPerson > 20) {
      insights.push("High individual productivity - ensure quality isn't compromised");
    } else if (unitsPerPerson < 5) {
      insights.push("Low individual productivity - investigate bottlenecks");
      recommendations.push("Review processes and identify efficiency improvements");
    }

    return {
      insights,
      recommendations,
      teamSize: this.categorizeTeamSize(totalTeamMembers),
      utilizationStatus: this.getUtilizationStatus(utilization)
    };
  }

  /**
   * Categorize team size
   * @param {number} teamSize - Number of team members
   * @returns {string} Team size category
   */
  static categorizeTeamSize(teamSize) {
    if (teamSize <= 2) return "solo";
    if (teamSize <= 5) return "small";
    if (teamSize <= 15) return "medium";
    if (teamSize <= 50) return "large";
    return "enterprise";
  }

  /**
   * Calculate cost implications
   * @param {Object} humanCapitalData - Human capital data
   * @param {number} avgHourlyRate - Average hourly rate for team members
   * @param {number} contractorRate - Contractor hourly rate
   * @returns {Object} Cost implications
   */
  static calculateCostImplications(humanCapitalData, avgHourlyRate = 50, contractorRate = 75) {
    const { totalCapacity, totalNeededHours, contractorHours, totalTeamMembers } = humanCapitalData;
    
    const teamCost = (totalCapacity - contractorHours) * avgHourlyRate;
    const contractorCost = contractorHours * contractorRate;
    const totalCost = teamCost + contractorCost;
    
    const costPerUnit = totalUnitsPerMonth > 0 ? totalCost / totalUnitsPerMonth : 0;
    const costPerTeamMember = totalTeamMembers > 0 ? totalCost / totalTeamMembers : 0;

    return {
      teamCost,
      contractorCost,
      totalCost,
      costPerUnit,
      costPerTeamMember,
      hourlyRate: avgHourlyRate,
      contractorRate
    };
  }
}

export default HumanCapitalCalculationService;
