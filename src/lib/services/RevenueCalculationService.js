/**
 * RevenueCalculationService
 * Handles all revenue calculation logic for the Revenue Stack module
 */

class RevenueCalculationService {
  /**
   * Calculate revenue metrics based on input data
   * @param {Object} inputs - Revenue input data
   * @param {string} inputs.productName - Name of the product/service
   * @param {number} inputs.avgGrossPerUnit - Average gross revenue per unit
   * @param {number} inputs.avgOrdersPerMonthPerCustomer - Average orders per month per customer
   * @param {number} inputs.totalCustomers - Total number of customers
   * @returns {Object} Calculated revenue metrics
   */
  static calculateRevenue(inputs) {
    const {
      productName,
      avgGrossPerUnit,
      avgOrdersPerMonthPerCustomer,
      totalCustomers
    } = inputs;

    // Validate inputs
    if (!productName || !avgGrossPerUnit || !avgOrdersPerMonthPerCustomer || !totalCustomers) {
      throw new Error('All revenue inputs are required');
    }

    // Convert to numbers for calculations
    const avgGross = parseFloat(avgGrossPerUnit);
    const avgOrders = parseFloat(avgOrdersPerMonthPerCustomer);
    const customers = parseInt(totalCustomers);

    // Validate numeric inputs
    if (isNaN(avgGross) || isNaN(avgOrders) || isNaN(customers)) {
      throw new Error('Invalid numeric inputs for revenue calculation');
    }

    if (avgGross <= 0 || avgOrders <= 0 || customers <= 0) {
      throw new Error('Revenue inputs must be positive numbers');
    }

    // Core calculations
    const totalUnitsPerMonth = avgOrders * customers;
    const monthlyRevenue = avgGross * totalUnitsPerMonth;
    const annualRevenue = monthlyRevenue * 12;

    return {
      productName,
      avgGrossPerUnit: avgGross,
      avgOrdersPerMonthPerCustomer: avgOrders,
      totalCustomers: customers,
      totalUnitsPerMonth,
      monthlyRevenue,
      annualRevenue
    };
  }

  /**
   * Calculate revenue growth projections
   * @param {Object} currentRevenue - Current revenue data
   * @param {number} growthRate - Annual growth rate (as decimal, e.g., 0.25 for 25%)
   * @param {number} years - Number of years to project
   * @returns {Object} Growth projections
   */
  static calculateGrowthProjections(currentRevenue, growthRate = 0.25, years = 5) {
    const { annualRevenue } = currentRevenue;
    const projections = [];

    for (let year = 1; year <= years; year++) {
      const projectedRevenue = annualRevenue * Math.pow(1 + growthRate, year);
      projections.push({
        year,
        projectedRevenue,
        growth: projectedRevenue - annualRevenue,
        growthRate: ((projectedRevenue - annualRevenue) / annualRevenue) * 100
      });
    }

    return {
      currentAnnualRevenue: annualRevenue,
      growthRate: growthRate * 100,
      projections
    };
  }

  /**
   * Calculate unit economics insights
   * @param {Object} revenueData - Revenue data
   * @returns {Object} Unit economics insights
   */
  static calculateUnitEconomicsInsights(revenueData) {
    const {
      avgGrossPerUnit,
      avgOrdersPerMonthPerCustomer,
      totalCustomers,
      monthlyRevenue,
      annualRevenue
    } = revenueData;

    const revenuePerCustomer = monthlyRevenue / totalCustomers;
    const annualRevenuePerCustomer = annualRevenue / totalCustomers;

    return {
      revenuePerCustomer: {
        monthly: revenuePerCustomer,
        annual: annualRevenuePerCustomer
      },
      customerValue: {
        monthlyOrders: avgOrdersPerMonthPerCustomer,
        averageOrderValue: avgGrossPerUnit,
        monthlyValue: revenuePerCustomer,
        annualValue: annualRevenuePerCustomer
      },
      volumeMetrics: {
        totalCustomers,
        monthlyUnits: revenueData.totalUnitsPerMonth,
        annualUnits: revenueData.totalUnitsPerMonth * 12
      }
    };
  }

  /**
   * Generate revenue insights and recommendations
   * @param {Object} revenueData - Revenue data
   * @returns {Object} Insights and recommendations
   */
  static generateRevenueInsights(revenueData) {
    const { monthlyRevenue, annualRevenue, totalCustomers } = revenueData;
    
    const insights = [];
    const recommendations = [];

    // Revenue scale insights
    if (annualRevenue < 100000) {
      insights.push("Early-stage revenue - focus on product-market fit and customer acquisition");
      recommendations.push("Consider increasing average order value or customer frequency");
    } else if (annualRevenue < 1000000) {
      insights.push("Growing revenue - optimize unit economics and scale operations");
      recommendations.push("Focus on customer retention and upselling opportunities");
    } else if (annualRevenue < 10000000) {
      insights.push("Established revenue - focus on operational efficiency and market expansion");
      recommendations.push("Consider new product lines or market segments");
    } else {
      insights.push("Large-scale revenue - focus on market leadership and strategic partnerships");
      recommendations.push("Explore acquisition opportunities and international expansion");
    }

    // Customer concentration insights
    const revenuePerCustomer = annualRevenue / totalCustomers;
    if (revenuePerCustomer > 100000) {
      insights.push("High-value customer base - focus on retention and relationship management");
    } else if (revenuePerCustomer < 10000) {
      insights.push("Volume-based revenue - focus on operational efficiency and cost management");
    }

    return {
      insights,
      recommendations,
      revenueScale: this.categorizeRevenueScale(annualRevenue),
      growthPotential: this.assessGrowthPotential(revenueData)
    };
  }

  /**
   * Categorize revenue scale
   * @param {number} annualRevenue - Annual revenue amount
   * @returns {string} Revenue scale category
   */
  static categorizeRevenueScale(annualRevenue) {
    if (annualRevenue < 100000) return "startup";
    if (annualRevenue < 1000000) return "growth";
    if (annualRevenue < 10000000) return "established";
    if (annualRevenue < 100000000) return "enterprise";
    return "large-enterprise";
  }

  /**
   * Assess growth potential
   * @param {Object} revenueData - Revenue data
   * @returns {Object} Growth potential assessment
   */
  static assessGrowthPotential(revenueData) {
    const { avgOrdersPerMonthPerCustomer, totalCustomers, monthlyRevenue } = revenueData;
    
    const potential = {
      customerGrowth: "medium",
      frequencyGrowth: "medium", 
      valueGrowth: "medium",
      overall: "medium"
    };

    // Assess customer growth potential
    if (totalCustomers < 50) {
      potential.customerGrowth = "high";
    } else if (totalCustomers > 1000) {
      potential.customerGrowth = "low";
    }

    // Assess frequency growth potential
    if (avgOrdersPerMonthPerCustomer < 2) {
      potential.frequencyGrowth = "high";
    } else if (avgOrdersPerMonthPerCustomer > 10) {
      potential.frequencyGrowth = "low";
    }

    // Calculate overall potential
    const highCount = Object.values(potential).filter(v => v === "high").length;
    const lowCount = Object.values(potential).filter(v => v === "low").length;
    
    if (highCount >= 2) potential.overall = "high";
    else if (lowCount >= 2) potential.overall = "low";

    return potential;
  }
}

export default RevenueCalculationService;
