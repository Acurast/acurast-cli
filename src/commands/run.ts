import { Command } from "commander";
import { acurastColor } from "../util.js";
import ora from "../util/ora.js";

// TODO: remove?
export const addCommandRun = (program: Command) => {
  program
    .command("run")
    .alias("serve")
    .description("(v2) Run the project locally for development")
    .action(async () => {
      console.log("Initializing Acurast CLI");

      const spinner = ora("Loading unicorns").start();

      setTimeout(() => {
        spinner.color = "cyan";
        spinner.text = `${acurastColor("test")}`;
      }, 1000);
    });
};
