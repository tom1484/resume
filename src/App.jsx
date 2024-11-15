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
import { skills } from './data/skills';

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

      {/* Projects Section - Highlight personal or professional projects */}
      <Title title="Projects" />
      <Experiences title="Projects" data={projects} />

      {/* Competitions Section - Showcase participation and achievements */}
      <Title title="Competitions" />
      <Experiences title="Competitions" data={competitions} />

      {/* Academic Experiences Section - Display research, teaching, or other academic activities */}
      <Title title="Academics" />
      <Experiences title="Academics" data={academics} />

      {/* Skills Section - List programming languages, tools, and technologies */}
      <Title title="Tech Skills" />
      <Skills data={skills} />

      {/* Bottom margin */}
      <div className="w-11/12 mb-3"></div>
    </div>
  );
}

export default App;
