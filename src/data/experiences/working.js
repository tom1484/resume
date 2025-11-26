// Configuration for this section
export const workingConfig = {};

export const working = [
  {
    title: 'Institute of Information Science, Academia Sinica',
    location: 'Nangang, Taipei',
    role: 'Algorithm Summer Intern',
    time: 'Jul 2023 - Aug 2023',
    link: [
      { text: 'Project', url: 'https://github.com/IIS-summer-2023/meds-simd-highlevel' },
    ],
    content: [
      'Accelerated a Post-Quantum Cryptography (PQC) signature scheme by implementing vectorized AVX2 instruction sets (SIMD) on x86-64 architecture.',
      'Achieved a 500% performance speedup while enforcing constant-time execution to mitigate timing-based side-channel attacks.',
    ],
    tags: ['C++', 'SIMD', 'Post-Quantum Cryptography', 'Cybersecurity']
  },
  {
    title: 'Ambarella Inc.',
    role: 'Software Engineering Intern - Embedded AI, Algorithm, Tools',
    time: 'Jun 2025 - Aug 2025',
    location: 'Santa Clara, CA',
    content: [
      'Architected a dynamic weight adaptation mechanism for motion detection CNNs, designing convolutional LoRA adapters conditioned on ISP metadata.',
      'Optimized the model training pipeline to generalize across varying camera settings; reduced redundant training by ~20% while maintaining high accuracy.',
      'Stabilized model convergence significantly, reducing evaluation loss variance by 90%, ensuring reliable performance in diverse settings.',
    ],
    tags: ['Embedded Systems', 'Edge Computer Vision']
  },
];