export const projects = [
  {
    title: 'NTUEE LightDance - Light Effect Editor',
    time: 'Oct 2023 - Mar 2024',
    link: [
      { text: 'Project', url: 'https://github.com/NTUEELightDance/LightDance-Editor' },
      { text: 'Video', url: 'https://www.youtube.com/watch?v=ZYaDQQLl05Y' },
    ],
    // description: 'Light effect editor for the LightDance show at NTUEE',
    content: [
      'Built a Rust backend server from scratch to handle complex SQL manipulations for the LightDance Editor.',
      'Developed a Blender add-on for light effect editing and 3D previewing from scratch.',
      'Improved performance by approximately 5× compared to the previous JavaScript-based version.',
      'Led a team of 10 members to develop the software and integrate it with the hardware.',
    ],
    tags: ['Rust', 'Python', 'MySQL', 'GraphQL', 'Async Programming', 'Blender Add-on']
  },
  {
    title: 'Automatic Frisbee Shooter',
    time: 'Sep 2023 - Dec 2023',
    content: [
      'Developed an automatic frisbee shooter with ROS on Raspberry Pi',
      'Implemented a PID control system to adjust the shooting parameter and robot movement.',
      'Designed a detection system using OpenCV to detect the target and adjust the shooting direction.',
    ],
    tags: ['Embedded Systems', 'OpenCV', 'PID Control'],
  },
  {
    title: 'FPGA Laser Shooter',
    time: 'May 2023 - June 2023',
    content: [
      'Designed a laser shooting system written in Verilog on FPGA, integrated with cricle detection and shooting control.',
      'Implemented a pipelined architecture for real-time image processing.',
    ],
    tags: ['FPGA', 'Verilog', 'Image Processing'],
  },
  {
    title: 'MusicTracker - Automatic Music Sheet Page Turner',
    time: 'May 2023',
    link: [
      { text: 'Video', url: 'https://youtu.be/sDXGI1Jq3kc' },
    ],
    // description: 'Automatic music sheet page turner in a 24-hour hackathon',
    content: [
      'Implemented real-time audio recording and processing on an STM32 board using DMA for the I2S protocol and the CMSIS DSP library.',
      'Developed a dynamic time warping (DTW) algorithm on the STM32 to match the music sheet with the music being played.',
      'Integrated the system with a servo motor to automatically turn music sheet pages.',
    ],
    tags: ['Embedded Systems', 'Real-Time Audio Processing', 'Music Tracking with DTW']
  },
  {
    title: 'MoneyManager - Personal Finance Tracker',
    time: 'Dec 2022 - Jan 2023',
    link: [
      { text: 'Project', url: 'https://github.com/tom1484/money-manager' },
    ],
    // description: 'Android bookkeeping application',
    content: [
      'Developed a mobile app for tracking income and expenses across personal accounts.',
      'Built a full-stack React Native application with MongoDB as the database and Express.js as the backend server.',
    ],
    tags: ['React Native', 'Android', 'MongoDB', 'Express.js', 'RESTful API']
  },
  {
    title: 'MKS Access System - Entrance Recording System',
    time: 'Jun 2022 - Oct 2022',
    link: [
      { text: 'Project', url: 'https://drive.google.com/file/d/1EKJGVKytfbCwLHq-11mKcscFEMStKAA6/view?usp=share_link' },
    ],
    // description: 'Entrance recording system for NTUEE MakerSpace',
    content: [
      'Designed a physical system in C++ to record students’ entrances to the MakerSpace.',
      'Integrated an ID card scanner, LCD screen, Raspberry Pi, and server for instructions and backend management.',
    ],
    tags: ['Raspberry Pi', 'C++ Peripheral Control']
  },
  {
    title: 'Furuta Pendulum - Digital Controller Design',
    time: 'Dec 2022',
    link: [
      { text: 'Report', url: 'https://drive.google.com/file/d/18b7DX8dk0K--bYAh3qZRaT6zejtQcBO7/view?usp=share_link' },
    ],
    // description: 'Digital Controller Design for Furuta Pendulum',
    content: [
      'Designed and analyzed a LQR controller for the linearized system of Furuta pendulum in Simulink simulation.',
      'Implemented the controller on a real device and achieved a stable and accurate control performance.',
    ],
    tags: ['Control System Design', 'Simulink']
  },
  {
    title: 'Ear Detection Gate - Ear Shape Identification System',
    time: '2020',
    // description: 'Gate System for Identifying People by Ear Shape',
    content: [
      'Designed a scan system to identify people by ear shape using Yolo.',
      'Achieved identification without taking off masks during the COVID-19 pandemic.',
    ],
    tags: ['Object Detection', 'Yolo', 'Python']
  },
  {
    title: 'Intelligent Shopping Cart - Indoor Navigation and Checkout System',
    highlight: 'Patent',
    time: 'Jan 2020 - Apr 2020',
    link: [
      { text: 'Intro', url: 'https://www.youtube.com/watch?v=WfrQ2J9VpX0' }
    ],
    // description: 'Shopping cart system for indoor navigation and automatic checkout',
    content: [
      'Developed a shopping cart mobile application navigating customers to the desired items in a store.',
      'Implemented precise indoor localization using BLE beacons and filter algorithms.',
      'Aquired Taiwan\'s utility model patent for the system.',
    ],
    tags: ['Mobile App', 'Indoor Navigation', 'BLE', 'Patent']
  },
];
