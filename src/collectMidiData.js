const { inRange } = require('lodash')

const { MidiCommandType } = require('./constants.js')

const CC_COMMAND_TYPE_ID = 176

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

  const storeMidiValue = (deltaTime, [command, inputControlId, value]) => {
    if (verbose === true) {
      console.log({ command, inputControlId, value })
    }

    if (
      type === MidiCommandType.CC &&
      inRange(command, CC_COMMAND_TYPE_ID, CC_COMMAND_TYPE_ID + 16) === true
    ) {
      const inputChannel = command - CC_COMMAND_TYPE_ID + 1

      if (verbose === true) {
        console.log({ channel, inputChannel, controlId, inputControlId })
      }

      if (
        channel === inputChannel &&
        (controlId === null || controlId === inputControlId)
      ) {
        values.push(value)
      }
    }
  }

  input.on('message', storeMidiValue)
  await delay(duration)
  input.removeListener('message', storeMidiValue)

  return { channel, controlId, values }
}
