// Configuration for this section
export const competitionsConfig = {
  infoLayout: 'inline', // 'inline' or 'standalone'
};

export const competitions = [
  {
    title: 'Kibo RPC - International Space Robotics Challenge',
    highlight: 'World Champion',
    time: 'Jun 2022 - Oct 2022',
    link: [
      { text: 'Video', url: 'https://youtu.be/NjOgNrPMUJs?t=5368' },
    ],
    // description: 'International space robotics competition',
    content: [
      'Designed and implemented a vision-based laser aiming system for the Astrobee robot using OpenCV.',
      'Developed a trajectory planning algorithm to efficiently navigate the robot between designated points on the International Space Station.',
      'Achieved the world champion title in the final round, with successful deployment conducted aboard the International Space Station.',
    ],
    tags: ['Android', 'OpenCV', 'Path Planning', 'Space Robotics']
  },
  {
    title: 'Taipei City High School Programming Competition',
    time: 'Nov 2019',
    // description: 'Taipei City High School Programming Competition',
    content: [
      'Won third prize in a city-wide competition focused on solving complex problems using algorithms and data structures.',
    ],
    tags: ['Algorithm', 'Data Structure', 'C++']
  },
];
