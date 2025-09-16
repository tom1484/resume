import React, { useState, useEffect } from 'react';
import { useDataValidation } from '../hooks/useResumeData';
import { useConfig } from '../contexts/ConfigContext';
import { getData } from '../data';

export default function DataValidationDemo() {
  const [isVisible, setIsVisible] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});
  const [importStatus, setImportStatus] = useState('');
  const [dragState, setDragState] = useState({
    draggedSection: null,
    draggedItem: null,
    draggedSectionId: null,
    dragOverSection: null,
    dragOverItem: null,
    dragOverSectionId: null
  });
  const { validationResult, validating, revalidate, isValid } = useDataValidation();
  const { 
    sectionVisibility, 
    toggleSection, 
    itemVisibility,
    toggleItem,
    getSectionItemsWithVisibility,
    getOrderedSections,
    reorderSections,
    reorderItems,
    exportConfiguration,
    importConfiguration,
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

  // Drag and drop handlers
  const handleSectionDragStart = (e, sectionId, sectionIndex) => {
    setDragState(prev => ({
      ...prev,
      draggedSection: sectionIndex,
      draggedSectionId: sectionId
    }));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // For Firefox
  };

  const handleSectionDragOver = (e, sectionIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({
      ...prev,
      dragOverSection: sectionIndex
    }));
  };

  const handleSectionDragLeave = () => {
    setDragState(prev => ({
      ...prev,
      dragOverSection: null
    }));
  };

  const handleSectionDrop = (e, dropIndex) => {
    e.preventDefault();
    const { draggedSection } = dragState;
    if (draggedSection !== null && draggedSection !== dropIndex) {
      reorderSections(draggedSection, dropIndex);
    }
    setDragState({
      draggedSection: null,
      draggedItem: null,
      draggedSectionId: null,
      dragOverSection: null,
      dragOverItem: null,
      dragOverSectionId: null
    });
  };

  const handleItemDragStart = (e, sectionId, itemKey, itemIndex) => {
    setDragState(prev => ({
      ...prev,
      draggedItem: itemIndex,
      draggedSectionId: sectionId
    }));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    e.stopPropagation();
  };

  const handleItemDragOver = (e, sectionId, itemIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({
      ...prev,
      dragOverItem: itemIndex,
      dragOverSectionId: sectionId
    }));
    e.stopPropagation();
  };

  const handleItemDragLeave = (e) => {
    setDragState(prev => ({
      ...prev,
      dragOverItem: null,
      dragOverSectionId: null
    }));
    e.stopPropagation();
  };

  const handleItemDrop = (e, sectionId, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const { draggedItem, draggedSectionId } = dragState;
    if (draggedItem !== null && draggedSectionId === sectionId && draggedItem !== dropIndex) {
      reorderItems(sectionId, draggedItem, dropIndex);
    }
    setDragState({
      draggedSection: null,
      draggedItem: null,
      draggedSectionId: null,
      dragOverSection: null,
      dragOverItem: null,
      dragOverSectionId: null
    });
  };

  // Import/Export handlers
  const handleExport = () => {
    exportConfiguration();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        setImportStatus('Importing...');
        await importConfiguration(file);
        setImportStatus('✓ Imported successfully!');
        setTimeout(() => setImportStatus(''), 3000);
      } catch (error) {
        setImportStatus(`✗ Error: ${error.message}`);
        setTimeout(() => setImportStatus(''), 5000);
      }
      // Reset file input
      event.target.value = '';
    }
  };

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
          maxHeight: '200px', 
          overflow: 'auto',
          background: '#fff',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginTop: '5px'
        }}>
          {getOrderedSections().map((section, sectionIndex) => {
            const data = getData(section.dataKey);
            const hasItems = Array.isArray(data) && data.length > 0;
            const isExpanded = expandedSections[section.id];
            const itemsData = hasItems ? getSectionItemsWithVisibility(section.id) : [];
            const isDraggedSection = dragState.draggedSection === sectionIndex;
            const isDragOver = dragState.dragOverSection === sectionIndex;

            return (
              <div 
                key={section.id} 
                style={{ 
                  marginBottom: '6px',
                  opacity: isDraggedSection ? 0.5 : 1,
                  backgroundColor: isDragOver ? '#e3f2fd' : 'transparent',
                  border: isDragOver ? '2px dashed #2196f3' : '2px solid transparent',
                  borderRadius: '4px',
                  padding: '2px'
                }}
                draggable={true}
                onDragStart={(e) => handleSectionDragStart(e, section.id, sectionIndex)}
                onDragOver={(e) => handleSectionDragOver(e, sectionIndex)}
                onDragLeave={handleSectionDragLeave}
                onDrop={(e) => handleSectionDrop(e, sectionIndex)}
              >
                {/* Section level checkbox */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ 
                    cursor: 'grab',
                    fontSize: '10px',
                    color: '#666',
                    marginRight: '4px',
                    userSelect: 'none'
                  }}>⋮⋮</span>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    fontSize: '11px',
                    cursor: 'pointer',
                    flex: 1
                  }}>
                    <input
                      type="checkbox"
                      checked={sectionVisibility[section.id] || false}
                      onChange={() => toggleSection(section.id)}
                      style={{ marginRight: '6px' }}
                    />
                    <strong>{section.title || section.id}</strong>
                  </label>
                  
                  {/* Expand/collapse button for sections with items */}
                  {hasItems && (
                    <button
                      onClick={() => setExpandedSections(prev => ({
                        ...prev,
                        [section.id]: !prev[section.id]
                      }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '10px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        color: '#666'
                      }}
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                </div>

                {/* Item level checkboxes */}
                {hasItems && isExpanded && (
                  <div style={{ marginLeft: '20px', marginTop: '4px' }}>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '9px', color: '#666' }}>
                        ({itemsData.filter(item => item.visible).length}/{itemsData.length} visible)
                      </span>
                    </div>
                    
                    {itemsData.map((item, itemIndex) => {
                      const isDraggedItem = dragState.draggedItem === itemIndex && dragState.draggedSectionId === section.id;
                      const isDragOverItem = dragState.dragOverItem === itemIndex && dragState.dragOverSectionId === section.id;

                      return (
                        <div
                          key={item.itemKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '10px',
                            marginBottom: '2px',
                            opacity: isDraggedItem ? 0.5 : 1,
                            backgroundColor: isDragOverItem ? '#fff3e0' : 'transparent',
                            border: isDragOverItem ? '1px dashed #ff9800' : '1px solid transparent',
                            borderRadius: '2px',
                            padding: '1px 2px'
                          }}
                          draggable={true}
                          onDragStart={(e) => handleItemDragStart(e, section.id, item.itemKey, itemIndex)}
                          onDragOver={(e) => handleItemDragOver(e, section.id, itemIndex)}
                          onDragLeave={handleItemDragLeave}
                          onDrop={(e) => handleItemDrop(e, section.id, itemIndex)}
                        >
                          <span style={{ 
                            cursor: 'grab',
                            fontSize: '8px',
                            color: '#999',
                            marginRight: '4px',
                            userSelect: 'none'
                          }}>⋮</span>
                          <label style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            cursor: 'pointer',
                            color: item.visible ? '#000' : '#666',
                            flex: 1
                          }}>
                            <input
                              type="checkbox"
                              checked={item.visible}
                              onChange={() => toggleItem(section.id, item.itemKey)}
                              style={{ marginRight: '6px' }}
                            />
                            <span style={{ 
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '200px'
                            }}>
                              {item.title || item.itemKey}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Export/Import Configuration */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Configuration:</strong>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '6px',
          marginTop: '5px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExport}
              style={{
                background: '#4caf50',
                color: 'white',
                border: 'none',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '3px',
                flex: 1
              }}
              title="Export current configuration to JSON file"
            >
              📥 Export Config
            </button>
            
            <label style={{
              background: '#2196f3',
              color: 'white',
              border: 'none',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '3px',
              flex: 1,
              textAlign: 'center',
              display: 'block'
            }}>
              📤 Import Config
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          
          {importStatus && (
            <div style={{
              fontSize: '9px',
              color: importStatus.includes('✓') ? '#4caf50' : 
                    importStatus.includes('✗') ? '#f44336' : '#666',
              textAlign: 'center',
              padding: '2px',
              backgroundColor: '#f9f9f9',
              borderRadius: '2px'
            }}>
              {importStatus}
            </div>
          )}
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