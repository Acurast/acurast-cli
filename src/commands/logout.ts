import { Command } from "commander";

export const addCommandLogout = (program: Command) => {
  program
    .command("logout")
    .description("(v2) Log out of the Acurast CLI")
    .action(async () => {
      console.log("Not implemented yet!");
      // console.log("Logging out of the Acurast CLI");
    });
};
