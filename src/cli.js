#!/usr/bin/env node
const args = require('args')

const run = require('./index.js')

args.option('verbose', 'Print excessive MIDI data output')
const { verbose } = args.parse(process.argv)

run({ verbose }).catch(err => {
  console.log('Something went terribly wrong!')
  console.log(err)
  process.exit(0)
})
