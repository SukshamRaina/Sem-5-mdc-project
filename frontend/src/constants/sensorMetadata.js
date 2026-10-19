/**
 * Sensor metadata, physical descriptions, and risk tier definitions
 * based on the NASA C-MAPSS FD001 dataset and Phase 1 feature configuration.
 */

export const SENSOR_METADATA = {
  sensor_2: {
    code: 'sensor_2',
    name: 'T24',
    fullName: 'LPC Outlet Temperature',
    unit: '°R',
    description: 'Low-Pressure Compressor outlet total temperature',
    isTopFeature: false,
  },
  sensor_3: {
    code: 'sensor_3',
    name: 'T30',
    fullName: 'HPC Outlet Temperature',
    unit: '°R',
    description: 'High-Pressure Compressor outlet total temperature',
    isTopFeature: false,
  },
  sensor_4: {
    code: 'sensor_4',
    name: 'T50',
    fullName: 'LPT Outlet Temperature',
    unit: '°R',
    description: 'Low-Pressure Turbine outlet total temperature',
    isTopFeature: true,
  },
  sensor_7: {
    code: 'sensor_7',
    name: 'P30',
    fullName: 'HPC Outlet Pressure',
    unit: 'psia',
    description: 'High-Pressure Compressor outlet total pressure',
    isTopFeature: true,
  },
  sensor_8: {
    code: 'sensor_8',
    name: 'Nf',
    fullName: 'Physical Fan Speed',
    unit: 'rpm',
    description: 'Physical fan rotational speed',
    isTopFeature: false,
  },
  sensor_9: {
    code: 'sensor_9',
    name: 'Nc',
    fullName: 'Physical Core Speed',
    unit: 'rpm',
    description: 'Physical core rotational speed',
    isTopFeature: false,
  },
  sensor_11: {
    code: 'sensor_11',
    name: 'Ps30',
    fullName: 'HPC Outlet Static Pressure',
    unit: 'psia',
    description: 'High-Pressure Compressor static pressure',
    isTopFeature: true,
  },
  sensor_12: {
    code: 'sensor_12',
    name: 'phi',
    fullName: 'Fuel Flow to Ps30 Ratio',
    unit: 'pps/psi',
    description: 'Ratio of fuel flow to HPC static pressure',
    isTopFeature: true,
  },
  sensor_13: {
    code: 'sensor_13',
    name: 'Nf_dmd',
    fullName: 'Corrected Fan Speed',
    unit: 'rpm',
    description: 'Corrected fan rotational speed',
    isTopFeature: false,
  },
  sensor_14: {
    code: 'sensor_14',
    name: 'Nc_dmd',
    fullName: 'Corrected Core Speed',
    unit: 'rpm',
    description: 'Corrected core rotational speed',
    isTopFeature: false,
  },
  sensor_15: {
    code: 'sensor_15',
    name: 'BPR',
    fullName: 'Bypass Ratio',
    unit: 'ratio',
    description: 'Bypass duct mass flow to core mass flow ratio',
    isTopFeature: true,
  },
  sensor_17: {
    code: 'sensor_17',
    name: 'htBleed',
    fullName: 'Bleed Enthalpy',
    unit: 'BTU/lbm',
    description: 'Customer bleed enthalpy',
    isTopFeature: false,
  },
  sensor_20: {
    code: 'sensor_20',
    name: 'W31',
    fullName: 'HPT Coolant Bleed',
    unit: 'lbm/s',
    description: 'High-Pressure Turbine coolant bleed mass flow',
    isTopFeature: false,
  },
  sensor_21: {
    code: 'sensor_21',
    name: 'W32',
    fullName: 'LPT Coolant Bleed',
    unit: 'lbm/s',
    description: 'Low-Pressure Turbine coolant bleed mass flow',
    isTopFeature: true,
  },
};

export const RISK_TIERS = {
  CRITICAL: {
    level: 'CRITICAL',
    label: 'Critical Warning',
    threshold: '<= 25 cycles',
    badgeClass: 'badge-critical',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    description: 'Urgent component replacement or borescope inspection recommended before next dispatch.',
  },
  WARNING: {
    level: 'WARNING',
    label: 'Maintenance Warning',
    threshold: '26 - 50 cycles',
    badgeClass: 'badge-warning',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    description: 'Schedule shop maintenance within current operational planning cycle.',
  },
  MODERATE: {
    level: 'MODERATE',
    label: 'Moderate Degradation',
    threshold: '51 - 80 cycles',
    badgeClass: 'badge-moderate',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    description: 'Normal progressive wear. Continue regular trend logging.',
  },
  HEALTHY: {
    level: 'HEALTHY',
    label: 'Nominal Health',
    threshold: '> 80 cycles',
    badgeClass: 'badge-healthy',
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    description: 'Turbofan engine operating within nominal degradation tolerances.',
  },
};

export const getRiskInfo = (riskLevel) => {
  const normalized = (riskLevel || '').toUpperCase();
  return (
    RISK_TIERS[normalized] || {
      level: normalized || 'UNKNOWN',
      label: normalized || 'Unknown Status',
      threshold: 'N/A',
      badgeClass: 'badge-neutral',
      color: '#64748b',
      bgColor: '#f1f5f9',
      borderColor: '#cbd5e1',
      description: 'Status unavailable.',
    }
  );
};
