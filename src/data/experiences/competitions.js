// Configuration for this section
export const competitionsConfig = {};

export const competitions = [
  {
    title: 'CPLC Lander Challenge - Student Self-landing Rocket',
    location: 'Taipei & Hsinchu, Taiwan',
    role: 'Avionics Team Lead',
    time: 'Nov 2023 - Present',
    link: [
      { text: 'Team', url: 'https://www.facebook.com/p/STAR-Student-Society-of-Taiwan-Advanced-Rocketry-61558308603436/' },
    ],
    content: [
      'Spearheaded the avionics division for a VTVL (Vertical Takeoff, Vertical Landing) rocket, overseeing system integration and safety-critical control logic.',
      'Engineered a high-precision closed-loop control system for the Main Thrust Valve (MTV) to dynamically regulate propellant flow and thrust output.',
      'Architected the Thrust Vector Control (TVC) algorithm for stabilizing and targeting a 2,500N engine.',
    ],
    tags: ['Rocketry', 'Avionics', 'Embedded Systems', 'Control', 'System Engineering']
  },
  {
    title: 'Kibo RPC - International Space Robotics Challenge',
    highlight: 'World Champion',
    role: 'Navigation Team Lead',
    time: 'Jun 2022 - Oct 2022',
    link: [
      { text: 'Stream', url: 'https://youtu.be/NjOgNrPMUJs?t=5368' },
    ],
    content: [
      'Secured the World Championship representing Taiwan, with code successfully deployed on JAXA\'s Astrobee robot aboard the International Space Station.',
      'Developed a vision-based laser aiming system and an trajectory planning engine to autonomously navigate obstacle-filled "Keep-Out Zones" with high accuracy and safety.',
    ],
    // content: [
    //   'Designed and implemented a vision-based laser aiming system for the Astrobee robot using OpenCV.',
    //   'Developed a trajectory planning algorithm to efficiently navigate the robot between designated points on the International Space Station.',
    //   'Achieved the world champion title in the final round, with successful deployment conducted aboard the International Space Station.',
    // ],
    tags: ['Android', 'OpenCV', 'Trajectory Planning', 'Space Robotics', 'Visual Servoing']
  },
];