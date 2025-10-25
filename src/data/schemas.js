// Data validation schemas for resume sections

export const schemas = {
  // Base schema for experience-type entries (academics, projects, competitions, etc.)
  experience: {
    title: { type: 'string', required: true, minLength: 1 },
    titleFootnote: { type: 'string', required: false },
    highlight: { type: 'string', required: false },
    time: { type: 'string', required: true, minLength: 1 },
    link: { 
      type: 'array', 
      required: false, 
      itemSchema: {
        text: { type: 'string', required: true, minLength: 1 },
        url: { type: 'string', required: true, pattern: /^https?:\/\/.+/ }
      }
    },
    description: { type: 'string', required: false }, // Legacy field
    content: { 
      type: 'array', 
      required: true, 
      minLength: 1,
      itemType: 'string'
    },
    tags: { 
      type: 'array', 
      required: false,
      itemType: 'string'
    }
  },

  // Publication entries schema
  publication: {
    title: { type: 'string', required: true, minLength: 1 },
    authors: { 
      type: 'array', 
      required: true, 
      minLength: 1,
      itemType: 'string'
    },
    publication: {
      type: 'object',
      required: true,
      schema: {
        conference: { type: 'string', required: false },
        journal: { type: 'string', required: false },
        status: { type: 'string', required: true, minLength: 1 }
      },
      customValidation: (pub) => {
        return pub.conference || pub.journal ? null : 'Must have either conference or journal';
      }
    },
    time: { type: 'string', required: true, minLength: 1 },
    link: { 
      type: 'array', 
      required: false,
      itemSchema: {
        text: { type: 'string', required: true, minLength: 1 },
        url: { type: 'string', required: true, pattern: /^https?:\/\/.+/ }
      }
    },
    content: { 
      type: 'array', 
      required: true, 
      minLength: 1,
      itemType: 'string'
    },
    tags: { 
      type: 'array', 
      required: false,
      itemType: 'string'
    }
  },

  // Skills entries schema
  skill: {
    title: { type: 'string', required: true, minLength: 1 },
    icon: { type: 'string', required: true, minLength: 1 },
    category: { type: 'string', required: false }
  },

  // Personal info schema
  personalInfo: {
    info: {
      type: 'array',
      required: true,
      minLength: 1,
      itemSchema: {
        type: 'array',
        minLength: 2,
        maxLength: 2,
        itemType: 'string'
      }
    },
    link: {
      type: 'array',
      required: true,
      minLength: 1,
      itemSchema: {
        type: 'array',
        minLength: 2,
        maxLength: 2,
        schema: [
          { type: 'string', required: true, minLength: 1 },
          { type: 'string', required: true, pattern: /^https?:\/\/.+/ }
        ]
      }
    },
    qrcodes: {
      type: 'array',
      required: false,
      itemSchema: {
        type: 'array',
        minLength: 2,
        maxLength: 2,
        itemType: 'string'
      }
    }
  },

  // Education entries schema
  education: {
    time: { type: 'string', required: true, minLength: 1 },
    title: { type: 'string', required: true, minLength: 1 },
    content: {
      type: 'array',
      required: true,
      minLength: 1,
      itemSchema: {
        type: 'array',
        minLength: 2,
        maxLength: 2,
        itemType: 'string'
      }
    }
  }
};

// Schema mapping for different data types
export const schemaMap = {
  personalInfo: 'personalInfo',
  education: 'education',
  academics: 'experience',
  internships: 'experience', 
  publications: 'publication',
  competitions: 'experience',
  projects: 'experience',
  extracurriculars: 'experience',
  skills: 'skill'
};