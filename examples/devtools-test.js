// Test script that logs various things for ~1 minute, then exits.

console.log("Devtools test started", { jobId: _STD_.job.getId(), device: _STD_.device.getAddress() })
console.info("Processor info", { timestamp: Date.now() })

let tick = 0
const interval = setInterval(() => {
  tick++
  console.log("Tick " + tick, { elapsed: tick * 5 + "s" })

  if (tick % 3 === 0) {
    console.warn("Warning at tick " + tick + ": this is a test warning")
  }

  if (tick % 5 === 0) {
    try {
      JSON.parse("not valid json {{{")
    } catch (e) {
      console.error("Caught error at tick " + tick + ":", e.message)
    }
  }

  if (tick >= 12) {
    clearInterval(interval)
    console.log("Devtools test complete after " + tick + " ticks")
  }
}, 5000)
