/* eslint no-await-in-loop: 0 */
const { chunk, fill, max, min } = require('lodash')
const logUpdate = require('log-update')
const SOM = require('ml-som')

const { Axis, DEFAULT_DURATION, MidiCommandType } = require('./constants.js')
const collectMidiData = require('./collectMidiData.js')
const {
  createAggregator,
  aggregatePredictions,
} = require('./som-aggregation.js')

let predictions = []
let channelAggregations = []
let controlAggregations = []

function arr(numElements) {
  return new Array(numElements).fill(null)
}

module.exports.getPredictions = function getPredictions() {
  return predictions
}

module.exports.getChannelPredictions = function getChannelPredictions() {
  return channelAggregations
}

module.exports.getControlPredictions = function getControlPredictions() {
  return controlAggregations
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

  // Aggregated SOMs
  const channelAggregators = arr(channels.length).map(() =>
    createAggregator(controlIds.length)
  )
  const controlAggregators = arr(controlIds.length).map(() =>
    createAggregator(channels.length)
  )

  while (true) {
    // Get MIDI data for all channels and controls
    const midiInputListenerConfigs = arr(
      channels.length * controlIds.length
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

    channelAggregations = channelAggregators.map((network, i) =>
      aggregatePredictions(network, {
        predictions,
        dimensions: {
          x: channelAggregators.length,
          y: controlAggregators.length,
        },
        idx: i,
        axis: Axis.Y,
      })
    )
    controlAggregations = controlAggregators.map((network, i) =>
      aggregatePredictions(network, {
        predictions,
        dimensions: {
          x: channelAggregators.length,
          y: controlAggregators.length,
        },
        idx: i,
        axis: Axis.X,
      })
    )

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
              controlAggregations[controlIdx][1] === i &&
              controlAggregations[controlIdx][0] === j
                ? 1
                : 0
          )
          .join('')
        output += '\n'
      }

      output += '\n'
    }
    output += `\n    ${'-'.repeat(channels.length * 4)}-----------`
    output += '\n'

    for (let i = 0; i < 3; i += 1) {
      output += '    '

      output += channelAggregations
        .map(prediction => {
          const row = [0, 0, 0]
          if (prediction[1] === i) {
            row[prediction[0]] = 1
          }
          return row.join('')
        })
        .join('  ')

      output += '\n'
    }

    logUpdate(output)
  }
}
