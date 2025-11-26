import React, { createContext, useContext, useState } from 'react';
import { sectionsConfig } from '@config/sections';
import { getData } from '@data';

const ConfigContext = createContext();

export function ConfigProvider({ children }) {
  // Initialize section visibility from config
  const [sectionVisibility, setSectionVisibility] = useState(() => {
    const initial = {};
    sectionsConfig.forEach(section => {
      initial[section.id] = section.enabled;
    });
    return initial;
  });

  // Initialize section order
  const [sectionOrder, setSectionOrder] = useState(() => {
    return sectionsConfig.map(section => section.id);
  });

  // Initialize item order for each section
  const [itemOrder, setItemOrder] = useState(() => {
    const initial = {};
    sectionsConfig.forEach(section => {
      const data = getData(section.dataKey);
      if (Array.isArray(data)) {
        // Use index as stable identifier instead of title
        initial[section.id] = data.map((item, index) => index);
      }
    });
    return initial;
  });

  // Initialize item visibility for hierarchical control
  const [itemVisibility, setItemVisibility] = useState(() => {
    const initial = {};
    sectionsConfig.forEach(section => {
      const data = getData(section.dataKey);
      if (Array.isArray(data)) {
        initial[section.id] = {};
        data.forEach((item, index) => {
          // Use index as stable identifier instead of title
          initial[section.id][index] = true; // Default to visible
        });
      }
    });
    return initial;
  });

  // Column ratio state (percentage for left column)
  const [leftColumnRatio, setLeftColumnRatio] = useState(22);

  const toggleSection = (sectionId) => {
    setSectionVisibility(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleItem = (sectionId, itemKey) => {
    setItemVisibility(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [itemKey]: !prev[sectionId]?.[itemKey]
      }
    }));
  };

  const toggleAllItemsInSection = (sectionId, visible) => {
    setItemVisibility(prev => {
      const newSectionItems = {};
      const data = getData(sectionsConfig.find(s => s.id === sectionId)?.dataKey);
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          // Use index as stable identifier instead of title
          newSectionItems[index] = visible;
        });
      }
      return {
        ...prev,
        [sectionId]: newSectionItems
      };
    });
  };

  const updateLeftColumnRatio = (ratio) => {
    const numRatio = Math.max(10, Math.min(50, Number(ratio))); // Clamp between 10-50%
    setLeftColumnRatio(numRatio);
  };

  const reorderSections = (fromIndex, toIndex) => {
    setSectionOrder(prev => {
      const newOrder = [...prev];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return newOrder;
    });
  };

  const reorderItems = (sectionId, fromIndex, toIndex) => {
    setItemOrder(prev => ({
      ...prev,
      [sectionId]: prev[sectionId] ? (() => {
        const newOrder = [...prev[sectionId]];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, moved);
        return newOrder;
      })() : prev[sectionId]
    }));
  };

  const getOrderedSections = () => {
    return sectionOrder.map(sectionId =>
      sectionsConfig.find(section => section.id === sectionId)
    ).filter(Boolean);
  };

  const getVisibleSections = () => {
    return getOrderedSections().filter(section => sectionVisibility[section.id]);
  };

  const getVisibleItems = (sectionId) => {
    const section = sectionsConfig.find(s => s.id === sectionId);
    if (!section) return [];

    const data = getData(section.dataKey);
    if (!Array.isArray(data)) return data;

    // Apply custom ordering using indices
    const orderedData = itemOrder[sectionId] ?
      itemOrder[sectionId].map(itemIndex => data[itemIndex]).filter(Boolean) : data;

    return orderedData.filter((item, originalIndex) => {
      // Find the original index in the unordered data
      const dataIndex = data.indexOf(item);
      return itemVisibility[sectionId]?.[dataIndex] !== false;
    });
  };

  const getSectionItemsWithVisibility = (sectionId) => {
    const section = sectionsConfig.find(s => s.id === sectionId);
    if (!section) return [];

    const data = getData(section.dataKey);
    if (!Array.isArray(data)) return [];

    // Apply custom ordering using indices
    const orderedData = itemOrder[sectionId] ?
      itemOrder[sectionId].map(itemIndex => ({
        item: data[itemIndex],
        originalIndex: itemIndex
      })).filter(entry => entry.item) :
      data.map((item, index) => ({ item, originalIndex: index }));

    return orderedData.map(({ item, originalIndex }) => ({
      ...item,
      itemKey: originalIndex, // Use index as itemKey
      visible: itemVisibility[sectionId]?.[originalIndex] !== false,
      title: item.title || `Item ${originalIndex + 1}` // Ensure title exists for display
    }));
  };

  const exportConfiguration = () => {
    const config = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      sectionVisibility,
      sectionOrder,
      itemVisibility,
      itemOrder,
      leftColumnRatio
    };

    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `resume-config-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importConfiguration = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);

          // Validate configuration structure
          if (!config.version) {
            throw new Error('Invalid configuration file: missing version');
          }

          // Apply configuration with fallbacks
          if (config.sectionVisibility) {
            setSectionVisibility(config.sectionVisibility);
          }
          if (config.sectionOrder) {
            setSectionOrder(config.sectionOrder);
          }
          if (config.itemVisibility) {
            setItemVisibility(config.itemVisibility);
          }
          if (config.itemOrder) {
            setItemOrder(config.itemOrder);
          }
          if (typeof config.leftColumnRatio === 'number') {
            setLeftColumnRatio(config.leftColumnRatio);
          }

          resolve(config);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const value = {
    sectionVisibility,
    setSectionVisibility,
    toggleSection,
    itemVisibility,
    setItemVisibility,
    toggleItem,
    toggleAllItemsInSection,
    sectionOrder,
    setSectionOrder,
    itemOrder,
    setItemOrder,
    reorderSections,
    reorderItems,
    leftColumnRatio,
    setLeftColumnRatio,
    updateLeftColumnRatio,
    getOrderedSections,
    getVisibleSections,
    getVisibleItems,
    getSectionItemsWithVisibility,
    exportConfiguration,
    importConfiguration,
    allSections: sectionsConfig
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}