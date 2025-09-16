export const internships = [
  {
    title: "IIS Summer Intern - Accelerated Post-Quantum Cryptography",
    highlight: "",
    time: "Jul 2023 - Aug 2023",
    location: "Nangang, Taipei",
    link: [
      { text: "Project", url: "https://github.com/IIS-summer-2023/meds-simd-highlevel" },
    ],
    // description: "Accelerating post-quantum cryptography (PQC) algorithms",
    content: [
      "Reconstructed a post-quantum cryptography algorithm using the AVX256 instruction set in C++ on the x86-64 architecture.",
      "Achieved a 5× performance improvement compared to the original implementation while maintaining constant execution time for security.",
    ],
    tags: ["C++", "SIMD", "Cryptography"]
  },
  {
    title: "Ambarella Software Engineering Intern - Embedded AI, Algorithm, Tools",
    highlight: "",
    time: "Jun 2025 - Aug 2025",
    location: "Santa Clara, CA",
    link: [
      { text: "Company", url: "https://www.ambarella.com/" },
    ],
    content: [
      "Refactored and modularized the legacy AI Image Signal Processing (AISP) motion detection codebase, improving readability, maintainability, and enabling faster experimentation with new ML modules.",
      "Integrated ParamNet into the motion detection CNN architecture, designing convolutional LoRA adapters conditioned on ISO and shutter ratio embeddings to dynamically adapt network weights for different camera settings.",
      "Developed a pre-training and fine-tuning pipeline across varying ISO/shutter ratios, reducing redundant training runs by ~20% and enabling efficient adaptation to narrower ranges of settings.",
      "Significantly improved training stability: reduced the variance of evaluation loss fluctuations by over 10× compared to the baseline, yielding smoother convergence and more reliable model performance.",
    ],
    tags: ["Python", "Embedded Systems", "Machine Learning", "Image Signal Processing", "Computer Vision"]
  },
];
