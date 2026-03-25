const payload = JSON.stringify({
  job_id: _STD_.job.getId(),
  device_id: _STD_.device.getAddress(),
  timestamp: Date.now(),
})

httpPOST(
  'https://webhook.watch/api/res/1e7e5cd2-6c1e-465e-9d5d-76d1fd3d8bd1',
  payload,
  { 'Content-Type': 'application/json' },
  (response) => {
    print('POST successful: ' + response)
  },
  (error) => {
    print('POST failed: ' + error)
  }
)
