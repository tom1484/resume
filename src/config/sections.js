export const sectionsConfig = [
  {
    id: 'personal-info',
    component: 'PersonalInfo',
    title: null,
    enabled: true,
    dataKey: 'personalInfo',
    props: {}
  },
  {
    id: 'education',
    component: 'Education',
    title: 'Education',
    enabled: true,
    dataKey: 'education',
    props: {}
  },
  {
    id: 'academic-experience',
    component: 'Experiences',
    title: 'Academic Experience',
    enabled: true,
    dataKey: 'academics',
    props: {
      title: 'Academic Experience',
      selectedTitles: []
    }
  },
  {
    id: 'internship',
    component: 'Experiences',
    title: 'Internship',
    enabled: true,
    dataKey: 'internships',
    props: {
      title: 'Internship',
      selectedTitles: []
    }
  },
  {
    id: 'publications',
    component: 'Publications',
    title: 'Publications',
    enabled: true,
    dataKey: 'publications',
    props: {}
  },
  {
    id: 'competition-experience',
    component: 'Experiences',
    title: 'Competition Experience',
    enabled: true,
    dataKey: 'competitions',
    props: {
      title: 'Competition Experience',
      selectedTitles: []
    }
  },
  {
    id: 'project-experience',
    component: 'Experiences',
    title: 'Project Experience',
    enabled: true,
    dataKey: 'projects',
    props: {
      title: 'Project Experience',
      selectedTitles: []
    }
  },
  {
    id: 'extracurricular',
    component: 'Experiences',
    title: 'Extracurricular',
    enabled: true,
    dataKey: 'extracurriculars',
    props: {
      title: 'Extracurricular',
      selectedTitles: []
    }
  },
  {
    id: 'technical-skills',
    component: 'Skills',
    title: 'Technical Skills',
    enabled: true,
    dataKey: 'skills',
    props: {}
  }
];