/* eslint no-await-in-loop: 0 */
const { chunk, fill, max, min } = require('lodash')
const logUpdate = require('log-update')
const SOM = require('ml-som')

const { DEFAULT_DURATION, MidiCommandType } = require('./constants.js')
const collectMidiData = require('./collectMidiData.js')

let predictions = []
let aggregatedPredictions = []

module.exports.getPredictions = function getPredictions() {
  return predictions
}

module.exports.getAggregatedPredictions = function getAggregatedPredictions() {
  return aggregatedPredictions
}

module.exports.analyse = async function analyse(
  midiInput,
  {
    channels = [0],
    command = MidiCommandType.CC,
    controlIds = [],
    device = null,
    duration = DEFAULT_DURATION,
    verbose = false,
  }
) {
  if (midiInput === null) {
    console.log('\nNo MIDI devices were found. 😔\n')
    return false
  }

  if (controlIds.length === 0) {
    console.log('\nYou must provide control IDs.\n')
    return false
  }

  midiInput.setMaxListeners(128)

  // MIDI channel SOM
  const som = new SOM(3, 3, {
    fields: [
      { name: 'frequency', range: [0, 400] },
      { name: 'range', range: [0, 127] },
    ],
  })
  som.train([
    { frequency: 80, range: 70 },
    { frequency: 1, range: 1 },
    { frequency: 10, range: 90 },
    { frequency: 350, range: 127 },
    { frequency: 70, range: 120 },
    { frequency: 150, range: 40 },
  ])

  // Aggregated SOM
  const aggregatedSom = new SOM(3, 3, {
    fields: channels.length,
  })
  aggregatedSom.train([fill(Array(channels.length), 0)])

  while (true) {
    // Get MIDI data for all channels and controls
    const midiInputListenerConfigs = fill(
      Array(channels.length * controlIds.length),
      0
    ).map((x, i) => ({
      duration: 1000,
      type: command,
      channel: channels[i % channels.length],
      controlId: controlIds[Math.floor(i / channels.length)],
      verbose,
    }))
    const midiChannelInputs = await Promise.all(
      midiInputListenerConfigs.map(config => collectMidiData(midiInput, config))
    )

    // Get SOM predictions
    predictions = midiChannelInputs.map(({ values }) => {
      const frequency = Math.min(400, values.length)
      const range = values.length > 0 ? max(values) - min(values) : 0
      const input = { frequency, range }
      const prediction = som.predict(input)
      som.train(input)

      return prediction
    })

    // Aggregate predictions per control
    const aggregatedInputs = chunk(predictions, channels.length).map(
      controlPredictions => controlPredictions.map(([x, y]) => (y * 3 + x) / 8)
    )
    aggregatedPredictions = aggregatedInputs.map(controlPredictions =>
      aggregatedSom.predict(controlPredictions)
    )

    aggregatedSom.train(aggregatedInputs)

    //
    // Log all the things
    //
    let output = `\n    ${channels.join('    ')}    |  🦄`
    output += `\n    ${'-'.repeat(channels.length * 4)}-----------`
    output += '\n'

    for (const controlId of controlIds) {
      output += `${String(controlId).padStart(3, ' ')}`

      const controlIdx = controlIds.indexOf(controlId)

      for (let i = 0; i < 3; i += 1) {
        output += i === 0 ? ' ' : '    '
        output += predictions
          .slice(
            controlIdx * channels.length,
            (controlIdx + 1) * channels.length
          )
          .map(prediction => {
            const row = [0, 0, 0]
            if (prediction[1] === i) {
              row[prediction[0]] = 1
            }
            return row.join('')
          })
          .join('  ')
        output += '  |  '
        output += [0, 0, 0]
          .map(
            (x, j) =>
              aggregatedPredictions[controlIdx][1] === i &&
              aggregatedPredictions[controlIdx][0] === j
                ? 1
                : 0
          )
          .join('')
        output += '\n'
      }

      output += '\n'
    }

    logUpdate(output)
  }
}
