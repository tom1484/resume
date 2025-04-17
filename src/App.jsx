import Title from './components/title';
import PersonalInfo from './components/personalInfo';
import Education from './components/education';
import Experiences from './components/experiences';
import Skills from './components/skills';

import { personalInfo } from './data/personal_info';
import { education } from './data/education';
import { projects } from './data/experiences/projects';
import { competitions } from './data/experiences/competitions';
import { academics } from './data/experiences/academics';
import { internships } from './data/experiences/internships.js';
import { extracurriculars } from './data/experiences/extracurricular';
import { skills } from './data/skills';

// TODO:
//   Certifications (TOEFL, GRE, etc.)

function App() {
  return (
    <div className="h-full flex flex-col items-center">
      {/* Top margin */}
      <div className="w-11/12 mb-3"></div>

      {/* Personal Information Section */}
      <PersonalInfo data={personalInfo} />

      {/* Education Section - Display academic background */}
      <Title title="Education" />
      <Education data={education} />

      {/* Academic Experiences Section - Display research, teaching, or other academic activities */}
      <Title title="Academic Experience" />
      <Experiences title="Academic Experience" data={academics} selectedTitles={[]} />

      {/* Academic Experiences Section - Display research, teaching, or other academic activities */}
      <Title title="Internship" />
      <Experiences title="Internship" data={internships} selectedTitles={[]} />

      {/* Competitions Section - Showcase participation and achievements */}
      <Title title="Competition Experience" />
      <Experiences title="Competition Experience" data={competitions} selectedTitles={[]} />

      {/* Projects Section - Highlight personal or professional projects */}
      <Title title="Project Experience" />
      <Experiences title="Project Experience" data={projects} selectedTitles={[]} />

      {/* Extracurricular Section - Hobbies and additional activities */}
      <Title title="Extracurricular" />
      <Experiences title="Extracurricular" data={extracurriculars} selectedTitles={[]} />

      {/* Skills Section - List programming languages, tools, and technologies */}
      <Title title="Technical Skills" />
      <Skills data={skills} />

      {/* Bottom margin */}
      <div className="w-11/12 mb-3"></div>
    </div>
  );
}

export default App;
