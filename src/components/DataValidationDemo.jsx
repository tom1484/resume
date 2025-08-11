import React, { useState, useEffect } from 'react';
import { useDataValidation } from '../hooks/useResumeData';
import { useConfig } from '../contexts/ConfigContext';

export default function DataValidationDemo() {
  const [isVisible, setIsVisible] = useState(true);
  const { validationResult, validating, revalidate, isValid } = useDataValidation();
  const { 
    sectionVisibility, 
    toggleSection, 
    leftColumnRatio, 
    updateLeftColumnRatio,
    allSections 
  } = useConfig();

  // Keyboard shortcut: Ctrl/Cmd + D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: '#f5f5f5', 
      padding: '15px', 
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      maxWidth: '300px',
      fontSize: '12px',
      zIndex: 1000
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <h4 style={{ margin: '0' }}>Resume Configuration</h4>
        <button 
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '0 5px'
          }}
          title="Hide Demo (Ctrl/Cmd + D to toggle)"
        >
          ✕
        </button>
      </div>
      
      {/* Section Visibility Controls */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Section Visibility:</strong>
        <div style={{ 
          maxHeight: '120px', 
          overflow: 'auto',
          background: '#fff',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginTop: '5px'
        }}>
          {allSections.map(section => (
            <label key={section.id} style={{ 
              display: 'flex', 
              alignItems: 'center',
              fontSize: '11px',
              marginBottom: '4px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={sectionVisibility[section.id] || false}
                onChange={() => toggleSection(section.id)}
                style={{ marginRight: '6px' }}
              />
              {section.title || section.id}
            </label>
          ))}
        </div>
      </div>

      {/* Column Ratio Control */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Left Column Ratio:</strong>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
          <input
            type="range"
            min="10"
            max="50"
            value={leftColumnRatio}
            onChange={(e) => updateLeftColumnRatio(e.target.value)}
            style={{ flex: 1, marginRight: '8px' }}
          />
          <input
            type="number"
            min="10"
            max="50"
            value={leftColumnRatio}
            onChange={(e) => updateLeftColumnRatio(e.target.value)}
            style={{ width: '50px', padding: '2px', fontSize: '11px' }}
          />
          <span style={{ fontSize: '11px', marginLeft: '4px' }}>%</span>
        </div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
          Right column: {100 - leftColumnRatio}%
        </div>
      </div>

      {/* Data Validation Status */}
      <div style={{ fontSize: '11px', color: '#666', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
        <strong>Data Status:</strong>{' '}
        <span style={{ 
          color: isValid === null ? '#888' : isValid ? '#28a745' : '#dc3545',
          fontWeight: 'bold'
        }}>
          {validating ? 'Validating...' : 
           isValid === null ? 'Unknown' : 
           isValid ? '✓ Valid' : '✗ Invalid'}
        </span>
        {validationResult && !validationResult.isValid && (
          <div style={{ fontSize: '10px', color: '#dc3545', marginTop: '4px' }}>
            {Object.keys(validationResult.errors).length} sections with errors
          </div>
        )}
      </div>
    </div>
  );
}