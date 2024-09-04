import PersonalInfo from './components/personalInfo';
import Education from './components/education';
import Experiences from './components/experiences';
import Skills from './components/skills';

import SplitLine from './components/splitLine';

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
      <SplitLine width="11/12" weight="300" />

      {/* Education Section - Display academic background */}
      <Education data={education} />
      <SplitLine width="11/12" weight="300" />

      {/* Competitions Section - Showcase participation and achievements */}
      <Experiences title="Competitions" data={competitions} />
      <SplitLine width="11/12" weight="300" />

      {/* Projects Section - Highlight personal or professional projects */}
      <Experiences title="Projects" data={projects} />
      <SplitLine width="11/12" weight="300" />

      {/* Academic Experiences Section - Display research, teaching, or other academic activities */}
      <Experiences title="Academics" data={academics} />
      <SplitLine width="11/12" weight="300" />

      {/* Skills Section - List technical and soft skills */}
      <Skills data={skills}/>
    </div>
  );
}

export default App;
