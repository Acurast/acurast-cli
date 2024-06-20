import { Command } from "commander";
import { SingleBar } from "cli-progress";
import { acurastColor } from "../util.js";

export const addCommandWatch = (program: Command) => {
  program
    .command("watch")
    .description("Watch the chain and get notified when a job update happens")
    .action(async () => {
      // create new progress bar
      const b1 = new SingleBar({
        format: "New Block " + acurastColor("{bar}") + " {value}s", // | {percentage}% |
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
      });

      b1.start(12, 0);

      // update values
      let counter = 0;
      setInterval(() => {
        counter++;
        b1.update(counter);
        b1.render();
        // b1.updateETA();
        if (counter >= 12) {
          b1.stop();
        }
      }, 1000);

      // stop the bar
    });
};
