const { inRange } = require('lodash')

const { MidiCommandType } = require('./constants.js')

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = async function collectMidiData(
  input,
  {
    duration,
    type = MidiCommandType.CC,
    controlId = null,
    channel = 0,
    verbose = false,
  }
) {
  const values = []

  const storeCcValue = message => {
    if (verbose === true) {
      console.log(message)
    }

    if (
      channel === message.channel &&
      (controlId === null || controlId === message.controller)
    ) {
      values.push(message.value)
    }
  }

  if (type === MidiCommandType.CC) {
    input.on('cc', storeCcValue)
  }

  await delay(duration)

  if (type === MidiCommandType.CC) {
    input.removeListener('message', storeCcValue)
  }

  return { channel, controlId, values }
}
