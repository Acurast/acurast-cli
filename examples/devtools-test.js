// Test script that logs various things for ~1 minute, then exits.

console.log("Devtools test started", { jobId: _STD_.job.getId(), device: _STD_.device.getAddress() })
console.info("Processor info", { timestamp: Date.now() })

// Probe runtime for HTTP/upload primitives
console.log("Runtime probe", {
  fetch: typeof fetch,
  FormData: typeof FormData,
  Blob: typeof Blob,
  XMLHttpRequest: typeof XMLHttpRequest,
  Request: typeof Request,
  Response: typeof Response,
  Headers: typeof Headers,
  Buffer: typeof Buffer,
  btoa: typeof btoa,
  atob: typeof atob,
})

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

  if (tick === 2) {
    const filename = "test-upload.json"
    const content = JSON.stringify({
      message: "hello from acurast processor",
      jobId: _STD_.job.getId().id,
      device: _STD_.device.getAddress(),
      timestamp: Date.now(),
    })

    console.log("Uploading file: " + filename + " (" + content.length + " bytes)")

    _DEVTOOLS_.uploadFile(
      filename,
      content,
      "application/json",
      (fileInfo) => {
        console.log("Upload succeeded", {
          id: fileInfo.id,
          filename: fileInfo.filename,
          mimeType: fileInfo.mimeType,
          fileSize: fileInfo.fileSize,
          createdAt: fileInfo.createdAt,
        })
      },
      (error) => {
        console.error("Upload failed:", error)
      }
    )
  }

  if (tick >= 12) {
    clearInterval(interval)
    console.log("Devtools test complete after " + tick + " ticks")
  }
}, 5000)
