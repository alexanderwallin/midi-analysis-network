/* eslint no-await-in-loop: 0 */
const { fill, max, min } = require('lodash')
const logUpdate = require('log-update')
const SOM = require('ml-som')

const collectMidiData = require('./collectMidiData.js')
const getMidiInput = require('./getMidiInput.js')

module.exports = async function run({ verbose }) {
  const midiInput = await getMidiInput()

  if (midiInput === null) {
    console.log('\nNo MIDI devices were found. 😔\n')
    process.exit(0)
  }

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
    fields: 8,
  })
  aggregatedSom.train([fill(Array(8), 0)])

  while (true) {
    const midiChannelInputs = await Promise.all(
      fill(Array(8), 0).map((x, i) =>
        collectMidiData(midiInput, {
          duration: 1000,
          type: 'cc',
          channel: 0,
          id: 1 + i,
          verbose,
        })
      )
    )

    const results = midiChannelInputs.map(midiValues => {
      const frequency = Math.min(400, midiValues.length)
      const range =
        midiValues.length > 0 ? max(midiValues) - min(midiValues) : 0
      const input = { frequency, range }
      const prediction = som.predict(input)
      som.train(input)

      return prediction
    })

    const aggregatedInput = results.map(([x, y]) => y * 3 + x)
    const aggregatedPrediction = aggregatedSom.predict(aggregatedInput)
    aggregatedSom.train([aggregatedInput])

    let output = '\n 1    2    3    4    5    6    7    8    |  🦄\n'

    for (let i = 0; i < 3; i += 1) {
      output += ' '
      output += results
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
            aggregatedPrediction[1] === i && aggregatedPrediction[0] === j
              ? 1
              : 0
        )
        .join('')
      output += '\n'
    }

    logUpdate(output)
  }
}
