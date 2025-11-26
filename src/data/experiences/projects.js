// Configuration for this section
export const projectsConfig = {
  showTags: false,
};

export const projects = [
  {
    title: 'Multimodal Perception of Corner Cases in Autonomous Driving',
    time: 'Nov 2024 - Dec 2024',
    content: [
      'Engineered a multimodal pipeline for autonomous driving using the CODA-LM dataset, targeting global scene understanding and local area reasoning.',
      'Fine-tuned LLaVA 1.5 7b via LoRA, integrating custom modules to resolve edge cases such as small object detection and complex traffic scenarios.',
    ],
    link: [
      { text: 'Project', url: 'https://github.com/tom1484/DLCV-Fall-2024-Final' },
      { text: 'Poster', url: 'https://drive.google.com/file/d/1gHW_4sjCmyUdZc4QdCCKXupIMWeTCsYI/view?usp=sharing' },
    ]
  },
  {
    title: 'NTUEE LightDance',
    location: 'Taipei, Taiwan',
    role: 'Software Team Lead',
    time: 'Oct 2023 - Mar 2024',
    link: [
      { text: 'Project', url: 'https://github.com/NTUEELightDance/LightDance-Editor' },
      { text: 'Stream', url: 'https://www.youtube.com/watch?v=HviYqvcldPU' },
    ],
    content: [
      'Orchestrated a 10-member team to architect a full-stack light effect editor, achieving a 500% performance increase over the legacy JavaScript system.',
      'Built a high-concurrency Rust backend managing complex SQL operations, supporting simultaneous editing across 5,000+ LEDs and 1,000+ keyframes.',
      'Developed a custom Blender add-on for real-time 3D visualization, enabling designers to preview light effects in a physically accurate environment.',
    ],
    tags: ['Rust', 'Python', 'MySQL', 'GraphQL', 'Async Programming', 'Blender Add-on']
  },
  {
    title: 'Automatic Frisbee Shooter',
    time: 'Sep 2023 - Dec 2023',
    content: [
      'Prototyped a fully automated 4-Wheel-Drive robot using ROS on Raspberry Pi, integrating navigation and actuation sub-systems with PID control loop.',
      'Engineered a computer vision tracking system to calculate frisbee angle and velocity based on real-time target data.',
    ],
    tags: ['Embedded Systems', 'OpenCV', 'PID Control'],
  },
  {
    title: 'FPGA Laser Shooter',
    time: 'May 2023 - June 2023',
    content: [
      'Designed a hardware-accelerated laser shooting system in Verilog, achieving low-latency target acquisition and firing control.',
      'Implemented a pipelined Hough Circle Transform architecture on FPGA for real-time target detection at high frame rates.',
    ],
    tags: ['FPGA', 'Verilog', 'Image Processing'],
  },
  {
    title: 'MusicTracker - Automatic Music Sheet Page Turner',
    time: 'May 2023',
    link: [
      { text: 'Demo', url: 'https://youtu.be/sDXGI1Jq3kc' },
    ],
    content: [
      'Developed a real-time audio processing system on STM32 using DMA and I2S, leveraging the CMSIS DSP library for Mel spectrogram analysis.',
      'Implemented a Dynamic Time Warping (DTW) algorithm to synchronize live audio with sheet music, triggering a servo-actuated page turner.',
    ],
    tags: ['Embedded Systems', 'Real-Time Audio Processing']
  },
  {
    title: 'MoneyManager - Personal Finance Tracker',
    time: 'Dec 2022 - Jan 2023',
    link: [
      { text: 'Project', url: 'https://github.com/tom1484/money-manager' },
    ],
    content: [
      'Built a cross-platform mobile application for finance tracking using React Native, featuring intuitive data visualization for income and expenses.',
      'Architected a RESTful backend with Express.js and MongoDB to handle user authentication and secure data persistence.',
    ],
    tags: ['React Native', 'Android', 'Fullstack']
  },
  {
    title: 'MKS Access System - Entrance Recording System',
    time: 'Jun 2022 - Oct 2022',
    link: [
      { text: 'Project', url: 'https://drive.google.com/file/d/1EKJGVKytfbCwLHq-11mKcscFEMStKAA6/view?usp=share_link' },
    ],
    content: [
      'Engineered an IoT access control system using C++ for peripheral management (ID scanner, LCD) on a Raspberry Pi.',
      'Integrated a server-side backend to log student entry data and display real-time usage instructions.',
    ],
    tags: ['Raspberry Pi', 'C++ Peripheral Control']
  },
  {
    title: 'Furuta Pendulum - Digital Controller Design',
    time: 'Dec 2022',
    link: [
      { text: 'Report', url: 'https://drive.google.com/file/d/18b7DX8dk0K--bYAh3qZRaT6zejtQcBO7/view?usp=share_link' },
    ],
    content: [
      'Modeled and linearized the dynamics of a Furuta pendulum to design an optimal LQR controller in Simulink.',
      'Deployed the control algorithm to physical hardware, achieving stable equilibrium and robust disturbance rejection.',
    ],
    tags: ['Control System Design', 'Simulink']
  },
  {
    title: 'Ear Detection Gate - Ear Shape Identification System',
    time: '2020',
    content: [
      'Developed a contactless biometric scanning system using YOLO object detection to identify individuals by ear shape.',
      'Designed the system to function effectively without mask removal, addressing specific security challenges during the COVID-19 pandemic.',
    ],
    tags: ['Object Detection', 'Yolo']
  },
  {
    title: 'Intelligent Shopping Cart - Indoor Navigation and Checkout System',
    highlight: 'Patent',
    time: 'Jan 2020 - Apr 2020',
    link: [
      { text: 'Demo', url: 'https://www.youtube.com/watch?v=WfrQ2J9VpX0' },
    ],
    content: [
      'Created a shopping cart system featuring BLE-based indoor localization and product guidance; awarded Taiwan Utility Model Patent.',
    ],
    tags: ['Mobile App', 'Indoor Navigation', 'BLE']
  },
];