/** Error handling utilities for structured API responses */

export interface ApiError {
  success: false;
  error_code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  request_id?: string;
}

export interface ErrorMapping {
  [errorCode: string]: {
    title: string;
    userMessage: string;
    action?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
}

// User-friendly error messages for each error code
export const ERROR_MESSAGES: ErrorMapping = {
  // Authentication errors
  'AUTH_1001': {
    title: 'Invalid Token',
    userMessage: 'Your authentication token is invalid. Please log in again.',
    action: 'Redirect to login',
    severity: 'high'
  },
  'AUTH_1002': {
    title: 'Session Expired',
    userMessage: 'Your session has expired. Please log in again.',
    action: 'Redirect to login',
    severity: 'high'
  },
  'AUTH_1003': {
    title: 'Access Denied',
    userMessage: 'You do not have permission to perform this action.',
    severity: 'medium'
  },
  'AUTH_1004': {
    title: 'User Not Found',
    userMessage: 'User account not found. Please contact support.',
    severity: 'high'
  },
  'AUTH_1005': {
    title: 'Invalid Credentials',
    userMessage: 'Invalid username or password.',
    action: 'Check credentials',
    severity: 'medium'
  },

  // Validation errors
  'VALIDATION_1101': {
    title: 'Invalid Input',
    userMessage: 'Please check your input and try again.',
    severity: 'low'
  },
  'VALIDATION_1102': {
    title: 'Missing Information',
    userMessage: 'Please fill in all required fields.',
    severity: 'low'
  },
  'VALIDATION_1103': {
    title: 'Invalid File Type',
    userMessage: 'This file type is not supported.',
    action: 'Use supported files',
    severity: 'low'
  },
  'VALIDATION_1104': {
    title: 'File Too Large',
    userMessage: 'File size exceeds the maximum limit.',
    action: 'Use smaller file',
    severity: 'medium'
  },

  // Resource errors
  'RESOURCE_1201': {
    title: 'Not Found',
    userMessage: 'The requested resource was not found.',
    severity: 'medium'
  },
  'RESOURCE_1202': {
    title: 'Already Exists',
    userMessage: 'This resource already exists.',
    severity: 'low'
  },
  'RESOURCE_1203': {
    title: 'In Use',
    userMessage: 'This resource is currently in use and cannot be modified.',
    severity: 'medium'
  },

  // Database errors
  'DB_1301': {
    title: 'Database Error',
    userMessage: 'A database error occurred. Please try again.',
    action: 'Retry request',
    severity: 'high'
  },
  'DB_1302': {
    title: 'Request Timeout',
    userMessage: 'The request took too long. Please try again.',
    action: 'Retry with smaller data',
    severity: 'medium'
  },

  // File errors
  'FILE_1401': {
    title: 'File Not Found',
    userMessage: 'The specified file was not found.',
    severity: 'medium'
  },
  'FILE_1402': {
    title: 'Upload Failed',
    userMessage: 'File upload failed. Please check the file and try again.',
    action: 'Retry upload',
    severity: 'medium'
  },
  'FILE_1403': {
    title: 'Delete Failed',
    userMessage: 'Failed to delete the file. Please try again.',
    action: 'Retry delete',
    severity: 'medium'
  },
  'FILE_1405': {
    title: 'Storage Full',
    userMessage: 'You have reached your storage limit.',
    action: 'Upgrade plan or delete files',
    severity: 'high'
  },

  // Network errors
  'NETWORK_1501': {
    title: 'Network Timeout',
    userMessage: 'Network request timed out. Please check your connection.',
    action: 'Check connection',
    severity: 'medium'
  },
  'NETWORK_1502': {
    title: 'Service Unavailable',
    userMessage: 'The service is temporarily unavailable.',
    action: 'Try again later',
    severity: 'high'
  },
  'NETWORK_1503': {
    title: 'Rate Limited',
    userMessage: 'Too many requests. Please wait and try again.',
    action: 'Wait before retry',
    severity: 'medium'
  },

  // ML errors
  'ML_1601': {
    title: 'Training Failed',
    userMessage: 'Model training failed. Please check your data and parameters.',
    severity: 'medium'
  },
  'ML_1602': {
    title: 'Model Not Found',
    userMessage: 'The specified model was not found.',
    severity: 'medium'
  },
  'ML_1603': {
    title: 'Insufficient Data',
    userMessage: 'Not enough data to train the model.',
    action: 'Add more data',
    severity: 'medium'
  },

  // System errors
  'SYSTEM_1701': {
    title: 'System Error',
    userMessage: 'An unexpected error occurred. Please try again.',
    action: 'Report issue',
    severity: 'high'
  },
  'SYSTEM_1702': {
    title: 'Maintenance',
    userMessage: 'The system is currently under maintenance.',
    action: 'Try again later',
    severity: 'medium'
  }
};

/**
 * Parse API error response and return user-friendly message
 */
export function parseApiError(error: any): { title: string; message: string; action?: string; severity: string } {
  // Handle network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      title: 'Network Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Check connection',
      severity: 'high'
    };
  }

  // Handle structured API errors
  if (error?.error_code) {
    const errorInfo = ERROR_MESSAGES[error.error_code] || {
      title: 'Error',
      userMessage: error.message || 'An error occurred',
      severity: 'medium'
    };

    return {
      title: errorInfo.title,
      message: errorInfo.userMessage,
      action: errorInfo.action,
      severity: errorInfo.severity
    };
  }

  // Handle legacy error responses
  if (error?.detail) {
    return {
      title: 'Error',
      message: typeof error.detail === 'string' ? error.detail : 'An error occurred',
      severity: 'medium'
    };
  }

  // Handle generic errors
  return {
    title: 'Error',
    message: error?.message || 'An unexpected error occurred',
    severity: 'medium'
  };
}

/**
 * Check if error requires authentication redirect
 */
export function requiresAuthRedirect(error: any): boolean {
  const parsed = parseApiError(error);
  return ['AUTH_1001', 'AUTH_1002', 'AUTH_1004'].includes(error?.error_code) ||
         parsed.title === 'Network Error';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  const retryableCodes = [
    'NETWORK_1501', 'NETWORK_1502', 'NETWORK_1503',
    'DB_1301', 'DB_1302',
    'FILE_1402', 'FILE_1403',
    'SYSTEM_1701', 'SYSTEM_1702'
  ];
  return retryableCodes.includes(error?.error_code);
}

/**
 * Get error color for UI based on severity
 */
export function getErrorColor(severity: string): string {
  switch (severity) {
    case 'low': return 'text-yellow-400';
    case 'medium': return 'text-orange-400';
    case 'high': return 'text-red-400';
    case 'critical': return 'text-red-600';
    default: return 'text-slate-400';
  }
}

/**
 * Format error details for display
 */
export function formatErrorDetails(error: any): string[] {
  const details: string[] = [];
  
  if (error?.details) {
    Object.entries(error.details).forEach(([key, value]) => {
      details.push(`${key}: ${value}`);
    });
  }
  
  if (error?.request_id) {
    details.push(`Request ID: ${error.request_id}`);
  }
  
  return details;
}
