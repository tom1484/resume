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
      'Built a Rust backend server handling complex SQL manipulation for LightDance Editor from scratch.',
      'Developed a Blender addon for light effect editing and 3D previewing from scratch.',
      'Increased the performance by ~5x overall, compared to the previous JavaScript-based version.',
      'Lead a team of 10 members to develop the software and integrate it with the hardware.',
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
      'Real-time audio recording and processing with STM32 board via DMA for I2S protocol and CMSIS DSP library.',
      'Implemented dynamic time warping (DTW) algorithm on STM32 to match the music sheet with the music being played.',
      'Integrated the system with a servo motor to turn the pages of the music sheet automatically.',
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
      'Developed a mobile bookkeeping application tracking the income and outcome of/between personal accounts.',
      'Full-stack React Native application using MongoDB as the database and Express.js as the backend server.',
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
      'Developed a physical system in C++, recording the entrance of students for the MakerSpace in the department.',
      'Integrated an ID card scanner, LCD screen, Raspberry Pi, and a server to provide instructions and backstage management.',
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
