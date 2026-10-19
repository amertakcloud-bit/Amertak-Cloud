import { useLanguage } from "../context/LanguageContext";

// Page: Projects
// Used for three routes: /projects, /projects/active, /projects/archived
// The "filter" prop decides which subset of projects to show.
const sampleProjects = [
  { name: "Khmer TTS Web App", status: "active" },
  { name: "Minecraft Launcher UI", status: "active" },
  { name: "Telegram Bot", status: "active" },
  { name: "Old Landing Page", status: "archived" },
  { name: "Legacy API Service", status: "archived" },
];

function Projects({ filter = "all" }) {
  const { t } = useLanguage();

  const filtered =
    filter === "all"
      ? sampleProjects
      : sampleProjects.filter((project) => project.status === filter);

  const titleKey =
    filter === "active"
      ? "activeProjects"
      : filter === "archived"
      ? "archivedProjects"
      : "allProjects";

  return (
    <div className="page">
      <h2 className="page-heading">{t(titleKey)}</h2>
      <p className="page-subtitle">{t("projectsSubtitle")}</p>

      <div className="card glass">
        <ul className="project-list">
          {filtered.map((project) => (
            <li key={project.name} className="project-list-item">
              <i className="ri-folder-3-line" aria-hidden="true"></i>
              <span>{project.name}</span>
              <span className={"status-badge " + project.status}>
                {project.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Projects;
