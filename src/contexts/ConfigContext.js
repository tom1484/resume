import React, { createContext, useContext, useState } from 'react';
import { sectionsConfig } from '../config/sections';
import { getData } from '../data';

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
        initial[section.id] = data.map((item, index) => item.title || `item-${index}`);
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
          const itemKey = item.title || `item-${index}`;
          initial[section.id][itemKey] = true; // Default to visible
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
          const itemKey = item.title || `item-${index}`;
          newSectionItems[itemKey] = visible;
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
    
    // Apply custom ordering
    const orderedData = itemOrder[sectionId] ? 
      itemOrder[sectionId].map(itemKey => 
        data.find((item, index) => (item.title || `item-${index}`) === itemKey)
      ).filter(Boolean) : data;
    
    return orderedData.filter((item, index) => {
      const itemKey = item.title || `item-${index}`;
      return itemVisibility[sectionId]?.[itemKey] !== false;
    });
  };

  const getSectionItemsWithVisibility = (sectionId) => {
    const section = sectionsConfig.find(s => s.id === sectionId);
    if (!section) return [];
    
    const data = getData(section.dataKey);
    if (!Array.isArray(data)) return [];
    
    // Apply custom ordering
    const orderedData = itemOrder[sectionId] ? 
      itemOrder[sectionId].map(itemKey => 
        data.find((item, index) => (item.title || `item-${index}`) === itemKey)
      ).filter(Boolean) : data;
    
    return orderedData.map((item, index) => {
      const itemKey = item.title || `item-${index}`;
      return {
        ...item,
        itemKey,
        visible: itemVisibility[sectionId]?.[itemKey] !== false
      };
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