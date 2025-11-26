const skillsData = {
  Languages: [
    {
      title: 'English (TOEFL 115, GRE 329)',
    }
  ],
  Programming: [
    {
      title: 'Rust',
      icon: 'rust.png',
    },
    {
      title: 'C/C++',
      icon: 'cpp.png',
    },
    {
      title: 'Python',
      icon: 'python.png',
    },
    {
      title: 'CUDA',
    },
    {
      title: 'TypeScript',
      icon: 'typescript.svg',
    },
  ],
  Frameworks: [
    {
      title: 'PyTorch',
    },
    {
      title: 'ROS2'
    },
    {
      title: 'React',
    },
    {
      title: 'Android Development',
    },
  ],
  'Design Tools': [
    {
      title: 'AutoCAD',
      icon: 'autocad.png',
    },
    {
      title: 'Fusion 360',
      icon: 'fusion360.png',
    },
    {
      title: 'KiCad',
    },
  ],
  Platforms: [
    {
      title: 'STM32',
      icon: 'stm32.png',
    },
    {
      title: 'MATLAB/Simulink',
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
