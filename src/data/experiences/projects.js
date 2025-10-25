// Configuration for this section
export const projectsConfig = {
  infoLayout: 'inline', // 'inline' or 'standalone'
};

export const projects = [
  {
    title: 'Multimodal Perception of Corner Cases in Autonomous Driving',
    time: 'Nov 2024 - Dec 2024',
    content: [
      'Developed a system for multimodal perception and comprehension in autonomous driving, focusing on global scene understanding, local area reasoning, and actionable navigation using the CODA-LM dataset.',
      'Enhanced the perception capabilities of LLaVA 1.5 7b by fine-tuning LoRA and incorporating additional modules to handle diverse scenes, small objects, and complex driving scenarios effectively.',
    ]
  },
  {
    title: 'NTUEE LightDance - Light Effect Editor',
    time: 'Oct 2023 - Mar 2024',
    link: [
      { text: 'Project', url: 'https://github.com/NTUEELightDance/LightDance-Editor' },
      { text: 'Video', url: 'https://www.youtube.com/watch?v=ZYaDQQLl05Y' },
    ],
    // description: 'Light effect editor for the LightDance show at NTUEE',
    content: [
      'Led a team of 10 members to develop a full-stack light effect editor, improving performance by approximately 5× compared to the previous JavaScript-based version.',
      'Built a Rust backend server from scratch to handle complex SQL manipulations, supporting up to 10 users simultaneously editing more than 5000 LEDs and 1000 frames.',
      'Developed a Blender add-on for light effect editing and 3D previewing from scratch, enabling real-time creation and visualization of light effects in a 3D environment.',
    ],
    tags: ['Rust', 'Python', 'MySQL', 'GraphQL', 'Async Programming', 'Blender Add-on']
  },
  {
    title: 'Automatic Frisbee Shooter',
    time: 'Sep 2023 - Dec 2023',
    content: [
      'Developed a fully-automated 4-Wheel-Drive frisbee shooter with ROS on Raspberry Pi.',
      'Implemented a PID control system to adjust shooting parameters and robot movement, and designed a mechanism for high-speed frisbee launching.',
      'Designed a detection system using OpenCV to track targets and adjust shooting direction according to frisbee dynamics.',
    ],
    tags: ['Embedded Systems', 'OpenCV', 'PID Control'],
  },
  {
    title: 'FPGA Laser Shooter',
    time: 'May 2023 - June 2023',
    content: [
      'Designed a laser shooting system written in Verilog on FPGA, integrated with target detection and shooting mechanism control.',
      'Implemented a pipelined architecture for real-time Hough Circle Transform to detect targets in images.',
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
      'Implemented real-time audio recording and processing on an STM32 board using DMA for the I2S protocol and the CMSIS DSP library for SFFT and Mel spectrogram analysis.',
      'Developed a dynamic time warping (DTW) algorithm on the STM32 to match music sheets with played audio, enabling automatic page turning via servo motor.',
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
      'Designed a physical system in C++ to record students\' entrances to our department\'s open lab.',
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
      'Designed and analyzed an LQR controller for the linearized system of a Furuta pendulum in Simulink.',
      'Implemented the controller on physical hardware and achieved stable, accurate control performance.',
    ],
    tags: ['Control System Design', 'Simulink']
  },
  {
    title: 'Ear Detection Gate - Ear Shape Identification System',
    time: '2020',
    // description: 'Gate System for Identifying People by Ear Shape',
    content: [
      'Designed a scanning system to identify people by ear shape using YOLO, enabling identification without mask removal during the COVID-19 pandemic.',
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
      'Developed a shopping cart mobile application that guides customers to desired items in indoor markets by implementing precise localization using BLE beacons and filter algorithms.',
      'Acquired Taiwan\'s utility model patent for the system as the patent owner.',
    ],
    tags: ['Mobile App', 'Indoor Navigation', 'BLE', 'Patent']
  },
];
