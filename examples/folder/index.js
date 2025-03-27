const sample = require('./data/sample.json')
console.log(sample)

const { test } = require('./test')
test(JSON.stringify(sample))
