// Configuration for this section
export const academicsConfig = {
  infoLayout: 'inline', // 'inline' or 'standalone'
};

export const academics = [
  {
    title: "Vision & Learning Lab, NTUEE",
    titleFootnote: "Prof. Frank Wang",
    highlight: "",
    time: "Jul 2024 - Present",
    link: [
      { text: "Presentations", url: "https://docs.google.com/presentation/d/1BW9Sg_MG2R7otxRP0OfcDCt2AEdg2iP72PS-oatu98o/edit?usp=sharing" },
    ],
    content: [
      "Proposed a framework for generalizable dynamic scene reconstruction using Gaussian Splatting by leveraging decomposed grid-based spatiotemporal representation.",
      "Developed a method utilizing the geometry cues from monocular depth estimation to enhance the quality of scene reconstruction using sparse voxel octrees."
    ],
    tags: ["Computer Vision", "Scene Reconstruction"]
  },
  {
    title: "Robot Learning Lab, NTUEE",
    titleFootnote: "Prof. Shao-Hua Sun",
    highlight: "",
    time: "Aug 2022 - Aug 2025",
    link: [
      { text: "Meetings", url: "https://docs.google.com/presentation/d/1Xv6ifq5p94_QihFSLVEMl6-prNVrInDqNQFzD4wy_0s/edit?usp=sharing" },
    ],
    content: [
      "Developed a sim-to-real transfer pipeline for online physical parameter estimation for robotic tasks using differentiable simulation.",
      "Developed a framework leveraging optical flows as action primitives to learn robotic skills from action-free videos, improving multi-task generalization and enabling cross-embodiment transfer; incorporated algorithm deployment on Mobile ALOHA, building real-world data collection pipeline.",
    ],
    tags: ["Reinforcement Learning", "Robotics", "Sim-to-Real Transfer", "Imitation Learning"]
  },
  {
    title: "Teaching Assistant",
    highlight: "",
    time: "2023 - Present",
    link: [],
    content: [
      "2023-2024 Spring - Cornerstone EECS Design and Implementation<br>Assisted first-year EE students in their first project integrating hardware and software, including Arduino, Python, algorithms, and system engineering.",
      "2024 Spring - Signals and Systems<br>Supporting students with signal processing concepts, Fourier transforms, and system analysis techniques.",
    ],
    // tags: ["Teaching", "Signals and Systems", "Electrical and Computer Engineering"]
  },
];
