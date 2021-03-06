#!/usr/bin/env node
const args = require('args')

const { DEFAULT_DURATION, MidiCommandType } = require('./constants.js')
const run = require('./index.js')

const OPTION_ALL = 'all'

args.option(
  'channels',
  'A comma-separated list of channels to listen to, or "all"'
)
args.option('controls', 'A comma-separated list of control IDs to listen to')
args.option(
  'command',
  '(Currently fixed) What MIDI command to listen to',
  MidiCommandType.CC
)
args.option(
  'device',
  'What MIDI device to listen to, defaulting to an interactive prompt where you can choose'
)
args.option(
  'duration',
  'How long each analysed MIDI segment should be',
  DEFAULT_DURATION
)
args.option('print', 'Print analysis table')
args.option('verbose', 'Print excessive MIDI data output')

const {
  channels,
  command,
  controls,
  device,
  duration,
  print,
  verbose,
} = args.parse(process.argv)

console.log({ channels })

const channelsArray =
  channels === OPTION_ALL
    ? new Array(16).fill(0).map((x, i) => i)
    : String(channels)
        .split(',')
        .map(x => parseInt(x))
console.log({ channelsArray })
const resolvedControlIds =
  controls === undefined
    ? []
    : String(controls)
        .split(',')
        .map(x => parseInt(x))

run({
  channels: channelsArray,
  command,
  controlIds: resolvedControlIds,
  device,
  duration,
  print,
  verbose,
}).catch(err => {
  console.log('\nSomething went terribly wrong!\n')
  console.log(err)
  process.exit(0)
})
