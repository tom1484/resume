// Data transformation utilities

// Transform raw data for display optimizations
export class DataTransformer {
  
  // Transform experience entries for better display
  static transformExperience(experienceItem) {
    const transformed = { ...experienceItem };
    
    // Process content with HTML breaks
    if (transformed.content) {
      transformed.processedContent = transformed.content.map(item => ({
        original: item,
        parts: item.split('<br>'),
        hasBreaks: item.includes('<br>')
      }));
    }
    
    // Extract year from time string for sorting
    if (transformed.time) {
      const yearMatch = transformed.time.match(/(\d{4})/);
      transformed.year = yearMatch ? parseInt(yearMatch[1]) : 0;
      
      // Parse time range
      const timeRangeMatch = transformed.time.match(/(\w+\s+\d{4})\s*-\s*(.+)/);
      if (timeRangeMatch) {
        transformed.startTime = timeRangeMatch[1];
        transformed.endTime = timeRangeMatch[2];
        transformed.isCurrent = timeRangeMatch[2].toLowerCase().includes('present');
      }
    }
    
    // Process tags for display
    if (transformed.tags) {
      transformed.tagString = transformed.tags.join(' | ');
      transformed.tagCategories = this.categorizeSkillTags(transformed.tags);
    }
    
    return transformed;
  }
  
  // Transform publication entries
  static transformPublication(publicationItem) {
    const transformed = { ...publicationItem };
    
    // Process authors with highlighting
    if (transformed.authors) {
      transformed.processedAuthors = transformed.authors.map(author => ({
        name: author.startsWith('!') ? author.slice(1) : author,
        isHighlighted: author.startsWith('!'),
        original: author
      }));
      
      transformed.authorString = transformed.processedAuthors
        .map(author => author.name)
        .join(', ');
    }
    
    // Extract publication info
    if (transformed.publication) {
      transformed.venue = transformed.publication.conference || transformed.publication.journal;
      transformed.publicationType = transformed.publication.conference ? 'conference' : 'journal';
    }
    
    return this.transformExperience(transformed);
  }
  
  // Transform skills for grouping
  static transformSkills(skillsArray) {
    return skillsArray.map(skill => ({
      ...skill,
      category: this.categorizeSkill(skill.title),
      hasIcon: Boolean(skill.icon)
    }));
  }
  
  // Transform personal info
  static transformPersonalInfo(personalInfo) {
    const transformed = { ...personalInfo };
    
    // Process info array into object for easier access
    if (transformed.info) {
      transformed.infoMap = Object.fromEntries(transformed.info);
    }
    
    // Process links
    if (transformed.link) {
      transformed.linkMap = Object.fromEntries(transformed.link);
      transformed.processedLinks = transformed.link.map(([text, url]) => ({
        text,
        url,
        domain: this.extractDomain(url),
        isExternal: !url.startsWith('/')
      }));
    }
    
    return transformed;
  }
  
  // Transform education entries
  static transformEducation(educationArray) {
    return educationArray.map(edu => ({
      ...edu,
      contentMap: Object.fromEntries(edu.content || []),
      year: this.extractYear(edu.time)
    }));
  }
  
  // Utility: Categorize skill tags
  static categorizeSkillTags(tags) {
    const categories = {
      programming: ['Python', 'C++', 'Rust', 'JavaScript', 'TypeScript'],
      frameworks: ['React', 'Node.js', 'Express.js', 'React Native'],
      tools: ['MATLAB', 'AutoCAD', 'Fusion 360', 'Blender'],
      domains: ['Machine Learning', 'Computer Vision', 'Robotics', 'Full Stack'],
      hardware: ['STM32', 'FPGA', 'Embedded Systems']
    };
    
    const result = {};
    for (const [category, keywords] of Object.entries(categories)) {
      result[category] = tags.filter(tag => 
        keywords.some(keyword => tag.toLowerCase().includes(keyword.toLowerCase()))
      );
    }
    
    return result;
  }
  
  // Utility: Categorize individual skills
  static categorizeSkill(skillTitle) {
    const categories = {
      'Programming Languages': ['Python', 'C++', 'Rust', 'TypeScript'],
      'Tools & Software': ['AutoCAD', 'Fusion 360', 'MATLAB'],
      'Hardware & Embedded': ['STM32'],
      'Web Development': ['Full Stack', 'TypeScript']
    };
    
    for (const [category, skills] of Object.entries(categories)) {
      if (skills.some(skill => skillTitle.toLowerCase().includes(skill.toLowerCase()))) {
        return category;
      }
    }
    
    return 'Other';
  }
  
  // Utility: Extract domain from URL
  static extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
  
  // Utility: Extract year from time string
  static extractYear(timeString) {
    const match = timeString.match(/(\d{4})/);
    return match ? parseInt(match[1]) : 0;
  }
}

// Data filtering utilities
export class DataFilter {
  
  // Filter experiences by date range
  static filterByDateRange(experienceArray, startYear, endYear) {
    return experienceArray.filter(item => {
      const year = DataTransformer.extractYear(item.time);
      return year >= startYear && year <= endYear;
    });
  }
  
  // Filter by tags
  static filterByTags(experienceArray, requiredTags, mode = 'any') {
    return experienceArray.filter(item => {
      if (!item.tags) return false;
      
      if (mode === 'all') {
        return requiredTags.every(tag => 
          item.tags.some(itemTag => itemTag.toLowerCase().includes(tag.toLowerCase()))
        );
      } else {
        return requiredTags.some(tag => 
          item.tags.some(itemTag => itemTag.toLowerCase().includes(tag.toLowerCase()))
        );
      }
    });
  }
  
  // Filter by search term
  static filterBySearch(experienceArray, searchTerm) {
    const term = searchTerm.toLowerCase();
    return experienceArray.filter(item => 
      item.title?.toLowerCase().includes(term) ||
      item.content?.some(content => content.toLowerCase().includes(term)) ||
      item.tags?.some(tag => tag.toLowerCase().includes(term))
    );
  }
  
  // Sort experiences
  static sortExperiences(experienceArray, sortBy = 'date', order = 'desc') {
    const sorted = [...experienceArray];
    
    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => {
          const yearA = DataTransformer.extractYear(a.time);
          const yearB = DataTransformer.extractYear(b.time);
          return order === 'desc' ? yearB - yearA : yearA - yearB;
        });
        break;
      case 'title':
        sorted.sort((a, b) => {
          const titleA = a.title?.toLowerCase() || '';
          const titleB = b.title?.toLowerCase() || '';
          return order === 'desc' ? titleB.localeCompare(titleA) : titleA.localeCompare(titleB);
        });
        break;
    }
    
    return sorted;
  }
}

// Data aggregation utilities
export class DataAggregator {
  
  // Get all unique tags across experiences
  static getAllTags(experienceArrays) {
    const allTags = new Set();
    
    experienceArrays.flat().forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => allTags.add(tag));
      }
    });
    
    return Array.from(allTags).sort();
  }
  
  // Get year range of experiences
  static getYearRange(experienceArrays) {
    const years = experienceArrays.flat()
      .map(item => DataTransformer.extractYear(item.time))
      .filter(year => year > 0);
      
    return years.length > 0 ? {
      min: Math.min(...years),
      max: Math.max(...years)
    } : { min: 0, max: 0 };
  }
  
  // Get tag frequency
  static getTagFrequency(experienceArrays) {
    const tagCount = {};
    
    experienceArrays.flat().forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagCount)
      .sort(([,a], [,b]) => b - a)
      .map(([tag, count]) => ({ tag, count }));
  }
}