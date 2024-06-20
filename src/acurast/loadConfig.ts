import fs from "fs";
import { AcurastCliConfig, AcurastProjectConfig } from "../types.js";

export const loadConfig = (
  project: string
): AcurastProjectConfig | undefined => {
  const filePath = "./acurast.json";
  const fileExists = fs.existsSync(filePath);
  if (!fileExists) {
    throw new Error(`acurast.json not found! Run "acurast init" first`);
  }
  const fileContent = fs.readFileSync(filePath, "utf-8");

  const config: AcurastCliConfig = JSON.parse(fileContent);

  if (!project) {
    const projects = Object.keys(config.projects);

    if (projects.length === 1) {
      return config.projects[projects[0]];
    }

    if (projects.length === 0) {
      throw new Error(
        `No projects found in acurast.json. Run "acurast init" first`
      );
    }

    throw new Error(
      `Project not specified. Available projects: ${projects.join(", ")}`
    );
  }

  if (config.projects[project]) {
    return config.projects[project];
  }

  throw new Error(`Project "${project}" not found in acurast.json`);
};
