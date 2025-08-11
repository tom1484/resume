import { schemas, schemaMap } from './schemas';

// Validation error class
export class ValidationError extends Error {
  constructor(message, field, value, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.errors = errors;
  }
}

// Validate a single field against its schema
function validateField(value, fieldSchema, fieldName) {
  const errors = [];

  // Check required fields
  if (fieldSchema.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  // Skip validation if field is optional and not provided
  if (!fieldSchema.required && (value === undefined || value === null)) {
    return errors;
  }

  // Type validation
  if (fieldSchema.type) {
    switch (fieldSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${fieldName} must be a string`);
          break;
        }
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          errors.push(`${fieldName} must be at least ${fieldSchema.minLength} characters long`);
        }
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          errors.push(`${fieldName} must be at most ${fieldSchema.maxLength} characters long`);
        }
        if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
          errors.push(`${fieldName} does not match required format`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${fieldName} must be an array`);
          break;
        }
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          errors.push(`${fieldName} must have at least ${fieldSchema.minLength} items`);
        }
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          errors.push(`${fieldName} must have at most ${fieldSchema.maxLength} items`);
        }

        // Validate array items
        if (fieldSchema.itemType) {
          value.forEach((item, index) => {
            if (typeof item !== fieldSchema.itemType) {
              errors.push(`${fieldName}[${index}] must be a ${fieldSchema.itemType}`);
            }
          });
        }

        if (fieldSchema.itemSchema) {
          value.forEach((item, index) => {
            const itemErrors = validateObject(item, fieldSchema.itemSchema, `${fieldName}[${index}]`);
            errors.push(...itemErrors);
          });
        }

        if (fieldSchema.schema && Array.isArray(fieldSchema.schema)) {
          // For tuple-like arrays with specific schemas for each position
          value.forEach((item, index) => {
            if (fieldSchema.schema[index]) {
              const itemErrors = validateField(item, fieldSchema.schema[index], `${fieldName}[${index}]`);
              errors.push(...itemErrors);
            }
          });
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          errors.push(`${fieldName} must be an object`);
          break;
        }
        if (fieldSchema.schema) {
          const objErrors = validateObject(value, fieldSchema.schema, fieldName);
          errors.push(...objErrors);
        }
        break;
    }
  }

  // Custom validation
  if (fieldSchema.customValidation) {
    const customError = fieldSchema.customValidation(value);
    if (customError) {
      errors.push(`${fieldName}: ${customError}`);
    }
  }

  return errors;
}

// Validate an object against a schema
function validateObject(obj, schema, prefix = '') {
  const errors = [];

  // Check all schema fields
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;
    const fieldErrors = validateField(obj[fieldName], fieldSchema, fullFieldName);
    errors.push(...fieldErrors);
  }

  return errors;
}

// Validate data array against a schema
export function validateDataArray(data, schemaType, dataKey) {
  if (!Array.isArray(data)) {
    throw new ValidationError(`Data for ${dataKey} must be an array`, dataKey, data);
  }

  const schema = schemas[schemaType];
  if (!schema) {
    throw new ValidationError(`Unknown schema type: ${schemaType}`, dataKey, data);
  }

  const allErrors = [];

  data.forEach((item, index) => {
    const itemErrors = validateObject(item, schema, `${dataKey}[${index}]`);
    allErrors.push(...itemErrors);
  });

  if (allErrors.length > 0) {
    throw new ValidationError(
      `Validation failed for ${dataKey}`,
      dataKey,
      data,
      allErrors
    );
  }

  return true;
}

// Validate single data item against a schema
export function validateDataItem(item, schemaType, dataKey) {
  const schema = schemas[schemaType];
  if (!schema) {
    throw new ValidationError(`Unknown schema type: ${schemaType}`, dataKey, item);
  }

  const errors = validateObject(item, schema, dataKey);

  if (errors.length > 0) {
    throw new ValidationError(
      `Validation failed for ${dataKey}`,
      dataKey,
      item,
      errors
    );
  }

  return true;
}

// Validate all resume data
export function validateResumeData(resumeData) {
  const errors = {};

  for (const [dataKey, data] of Object.entries(resumeData)) {
    try {
      const schemaType = schemaMap[dataKey];
      if (!schemaType) {
        console.warn(`No schema mapping found for data key: ${dataKey}`);
        continue;
      }

      if (dataKey === 'personalInfo') {
        validateDataItem(data, schemaType, dataKey);
      } else {
        validateDataArray(data, schemaType, dataKey);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        errors[dataKey] = error.errors;
      } else {
        errors[dataKey] = [error.message];
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Utility to get schema for a data key
export function getSchemaForDataKey(dataKey) {
  const schemaType = schemaMap[dataKey];
  return schemaType ? schemas[schemaType] : null;
}