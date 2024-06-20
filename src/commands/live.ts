import { Command, Option } from "commander";

export const addCommandLive = (program: Command) => {
  program
    .command("live")
    .description("Set up live coding environment on a processor.")
    .action(async (options: { dryRun?: boolean }) => {
      console.log("Initializing Acurast CLI");
      // Set up live coding environment on a processor.
      console.log("Options", options);
    });
};
