/**
 * Validation Utilities for Forms
 * Provides comprehensive validation for user inputs
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate name (min 2 characters, max 100, no special characters except spaces and hyphens)
 */
export function validateName(name: string): ValidationResult {
  const trimmed = name.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Name must be less than 100 characters' };
  }
  
  // Allow letters, spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\s\-']+$/;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'Name can only contain letters, spaces, and hyphens' };
  }
  
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim().toLowerCase();
  
  if (!trimmed) {
    return { valid: false, error: 'Email is required' };
  }
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  // Additional checks
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }
  
  return { valid: true };
}

/**
 * Validate institutional email (not from free providers)
 */
export function validateInstitutionalEmail(email: string): ValidationResult {
  const basicValidation = validateEmail(email);
  if (!basicValidation.valid) {
    return basicValidation;
  }
  
  const trimmed = email.trim().toLowerCase();
  const domain = trimmed.split('@')[1];
  
  // Free email providers not allowed for institutional registration
  const freeProviders = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'aol.com',
    'icloud.com',
    'protonmail.com',
    'mail.com',
    'zoho.com',
  ];
  
  if (freeProviders.includes(domain)) {
    return {
      valid: false,
      error: 'Please use your official institutional email address',
    };
  }
  
  return { valid: true };
}

/**
 * Validate phone number (10-15 digits)
 */
export function validatePhone(phone: string): ValidationResult {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length < 10) {
    return { valid: false, error: 'Phone number must be at least 10 digits' };
  }
  
  if (cleaned.length > 15) {
    return { valid: false, error: 'Phone number must be less than 15 digits' };
  }
  
  return { valid: true };
}

/**
 * Validate Indian phone number (exactly 10 digits)
 */
export function validateIndianPhone(phone: string): ValidationResult {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length !== 10) {
    return { valid: false, error: 'Phone number must be exactly 10 digits' };
  }
  
  // Indian mobile numbers start with 6, 7, 8, or 9
  const firstDigit = cleaned[0];
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return { valid: false, error: 'Invalid Indian mobile number' };
  }
  
  return { valid: true };
}

/**
 * Validate website URL
 */
export function validateWebsite(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { valid: true }; // Website is optional
  }
  
  const trimmed = url.trim();
  
  try {
    const parsed = new URL(trimmed);
    
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'URL must start with http:// or https://' };
    }
    
    // Check for valid domain
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return { valid: false, error: 'Invalid domain name' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Please enter a valid URL (e.g., https://example.com)' };
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' };
  }
  
  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  // Check for number
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  // Check for special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  
  return { valid: true };
}

/**
 * Password strength meter
 * Returns: weak, medium, strong
 */
export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

/**
 * Validate file upload
 */
export function validateFile(
  file: { size: number; type?: string; name?: string },
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): ValidationResult {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
    allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'],
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }
  
  // Check file type
  if (file.type && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only PDF, JPEG, and PNG files are allowed',
    };
  }
  
  // Check file extension
  if (file.name) {
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: 'Only PDF, JPEG, and PNG files are allowed',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Sanitize text input (remove potentially dangerous characters)
 */
export function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets (basic XSS prevention)
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate institution name
 */
export function validateInstitutionName(name: string): ValidationResult {
  const trimmed = name.trim();
  
  if (trimmed.length < 3) {
    return { valid: false, error: 'Institution name must be at least 3 characters' };
  }
  
  if (trimmed.length > 200) {
    return { valid: false, error: 'Institution name must be less than 200 characters' };
  }
  
  return { valid: true };
}

/**
 * Validate city name
 */
export function validateCity(city: string): ValidationResult {
  const trimmed = city.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'City name must be at least 2 characters' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'City name must be less than 100 characters' };
  }
  
  // Allow letters, spaces, hyphens
  const cityRegex = /^[a-zA-Z\s\-]+$/;
  if (!cityRegex.test(trimmed)) {
    return { valid: false, error: 'City name can only contain letters, spaces, and hyphens' };
  }
  
  return { valid: true };
}
