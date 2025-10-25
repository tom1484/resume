const skillsData = {
  Programming: [
    {
      title: 'Rust',
      icon: 'rust.png',
    },
    {
      title: 'C++',
      icon: 'cpp.png',
    },
    {
      title: 'Python',
      icon: 'python.png',
    },
    {
      title: 'TypeScript',
      icon: 'typescript.svg',
    },
  ],
  Tools: [
    {
      title: 'AutoCAD',
      icon: 'autocad.png',
    },
    {
      title: 'Fusion 360',
      icon: 'fusion360.png',
    },
  ],
  Others: [
    {
      title: 'Full Stack',
      icon: 'full-stack.png',
    },
    {
      title: 'STM32',
      icon: 'stm32.png',
    },
    {
      title: 'MATLAB',
      icon: 'matlab.png',
    },
  ]
};

// Export categorized skills data
export const skillsByCategory = skillsData;

// Export flattened skills array with category information
export const skills = Object.entries(skillsData).flatMap(([category, items]) =>
  items.map(item => ({
    ...item,
    category
  }))
);
