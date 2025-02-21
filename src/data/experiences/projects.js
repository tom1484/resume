export const projects = [
  {
    title: 'NTUEE LightDance',
    highlight: '',
    time: 'Oct 2023 - Mar 2024',
    link: [
      { text: 'project', url: 'https://github.com/NTUEELightDance/LightDance-Editor' },
      { text: 'video', url: 'https://www.youtube.com/watch?v=ZYaDQQLl05Y' },
    ],
    description: 'Light Effect Editor for LightDance Show in NTUEE',
    content: [
      'Built a Rust backend server from scratch to handle complex SQL manipulations for the LightDance Editor.',
      'Developed a Blender addon for light effect editing and 3D previewing from scratch.',
      'Improved performance by approximately 5x compared to the previous JavaScript-based version.',
      'Led a team of 10 members to develop the software and integrate it with the hardware.',
    ],
    tags: ['Rust', 'Python', 'MySQL', 'GraphQL', 'Async Programming', 'Blender Addon']
  },
  {
    title: 'MusicTracker',
    highlight: '',
    time: 'May 2023',
    link: [
      { text: 'video', url: 'https://youtu.be/sDXGI1Jq3kc' },
    ],
    description: 'Automatic Music Sheet Page Turner in 24-hour Hackathon',
    content: [
      'Implemented real-time audio recording and processing on an STM32 board using DMA for the I2S protocol and the CMSIS DSP library.',
      'Developed a dynamic time warping (DTW) algorithm on the STM32 to match the music sheet with the music being played.',
      'Integrated the system with a servo motor to automatically turn music sheet pages.',
    ],
    tags: ['Embedded System', 'Real-Time Audio Processing', 'Music Tracking with DTW']
  },
  {
    title: 'MoneyManager',
    highlight: '',
    time: 'Dec 2022 - Jan 2023',
    link: [
      { text: 'project', url: 'https://github.com/tom1484/money-manager' },
    ],
    description: 'Android Bookkeeping Application',
    content: [
      'Developed a mobile app for tracking income and expenses across personal accounts.',
      'Built a full-stack React Native application with MongoDB as the database and Express.js as the backend server.',
    ],
    tags: ['React Native', 'Android', 'MongoDB', 'Express.js', 'Restful API']
  },
  {
    title: 'MKS Access System',
    highlight: '',
    time: 'Jun 2022 - Oct 2022',
    link: [
      { text: 'project', url: 'https://drive.google.com/file/d/1EKJGVKytfbCwLHq-11mKcscFEMStKAA6/view?usp=share_link' },
    ],
    description: 'Entrance Recording System for NTUEE MakerSpace',
    content: [
      'Designed a physical system in C++ to record students’ entrances to the MakerSpace.',
      'Integrated an ID card scanner, LCD screen, Raspberry Pi, and server for instructions and backstage management.',
    ],
    tags: ['Raspberry Pi', 'C++ Peripheral Control']
  },
  // {
  //   title: '',
  //   highlight: '',
  //   time: '',
  //   link: [
  //     { text: '', url: '' },
  //   ],
  //   content: [
  //     ``,
  //   ],
  //   tags: []
  // },
];
