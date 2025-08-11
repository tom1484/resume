import { useState, useEffect } from 'react';
import { getData, getValidatedData, validateCurrentData, getCurrentProfile, switchProfile } from '../data';

// Custom hook for accessing resume data with validation
export function useResumeData(dataKey, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        setValidationErrors([]);

        let result;
        if (options.validate) {
          result = getValidatedData(dataKey, options);
        } else {
          result = getData(dataKey, options);
        }

        if (result === null) {
          throw new Error(`Data not found for key: ${dataKey}`);
        }

        setData(result);

        // Run validation separately to get validation errors without throwing
        if (options.showValidationWarnings) {
          const validation = validateCurrentData();
          if (!validation.isValid && validation.errors[dataKey]) {
            setValidationErrors(validation.errors[dataKey]);
          }
        }
      } catch (err) {
        console.error(`Failed to load data for ${dataKey}:`, err);
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataKey, JSON.stringify(options)]);

  return {
    data,
    loading,
    error,
    validationErrors,
    hasValidationErrors: validationErrors.length > 0
  };
}

// Hook for managing resume profiles
export function useResumeProfile() {
  const [currentProfile, setCurrentProfile] = useState(getCurrentProfile());
  const [switching, setSwitching] = useState(false);

  const switchToProfile = async (profileId) => {
    try {
      setSwitching(true);
      const success = switchProfile(profileId);
      if (success) {
        setCurrentProfile(getCurrentProfile());
        return true;
      } else {
        throw new Error(`Failed to switch to profile: ${profileId}`);
      }
    } catch (error) {
      console.error('Profile switch failed:', error);
      return false;
    } finally {
      setSwitching(false);
    }
  };

  return {
    currentProfile,
    switchToProfile,
    switching
  };
}

// Hook for data validation
export function useDataValidation() {
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);

  const validateData = async () => {
    try {
      setValidating(true);
      const result = validateCurrentData();
      setValidationResult(result);
      return result;
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        isValid: false,
        errors: { general: [error.message] }
      });
      return null;
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    validateData();
  }, []);

  return {
    validationResult,
    validating,
    revalidate: validateData,
    isValid: validationResult?.isValid ?? null
  };
}