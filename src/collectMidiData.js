async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = async function collectMidiData(
  input,
  { duration, type = 'cc', id = null, channel = 0, verbose = false }
) {
  const values = []

  const storeMidiValue = (deltaTime, [command, inputId, value]) => {
    if (verbose === true) {
      console.log({ command, inputId, value })
    }

    if (type === 'cc' && 176 <= command && command < 192) {
      if (channel === command - 176 && (id === null || id === inputId)) {
        values.push(value)
      }
    }
  }

  input.on('message', storeMidiValue)
  await delay(duration)
  input.removeListener('message', storeMidiValue)

  return values
}
