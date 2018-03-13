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
let aggregatedXor = []
let activeControls = []

function arr(numElements) {
  return new Array(numElements).fill(null)
}

function span(values) {
  return values.length === 0 ? 0 : max(values) - min(values)
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

module.exports.getActiveControls = function getActiveControls() {
  return activeControls
}

module.exports.analyse = async function analyse(
  midiInput,
  {
    channels = [0],
    command = MidiCommandType.CC,
    controlIds = [],
    device = null,
    duration = DEFAULT_DURATION,
    print = false,
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
    activeControls = midiChannelInputs
      .filter(({ values }) => values.length > 0)
      .map(({ values, ...props }) => {
        const minValue = min(values)
        const maxValue = max(values)

        return {
          ...props,
          min: minValue,
          max: maxValue,
          range: maxValue - minValue,
        }
      })

    // Get SOM predictions
    predictions = midiChannelInputs.map(({ values }) => {
      const frequency = Math.min(400, values.length)
      const range = span(values)
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
    aggregatedXor = new Array(9).fill(0).map((x, i) => {
      const row = Math.floor(i / 3)
      const col = i % 3

      return controlAggregations.some(
        aggr => aggr[0] === col && aggr[1] === row
      )
        ? 1
        : 0
    })

    //
    // Log all the things
    //
    if (print === true) {
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

        output += '  |  '

        output += aggregatedXor.slice(i * 3, i * 3 + 3).join('')

        output += '\n'
      }

      logUpdate(output)
    }
  }
}
