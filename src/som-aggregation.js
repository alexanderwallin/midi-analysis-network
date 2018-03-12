const { chunk } = require('lodash')
const SOM = require('ml-som')

const { Axis } = require('./constants.js')

function createAggregator(numFields) {
  return new SOM(3, 3, {
    fields: numFields,
  })
}

function aggregatePredictions(
  network,
  { predictions, dimensions, idx, axis = Axis.X }
) {
  const inputs =
    axis === Axis.X
      ? predictions.filter((x, i) => Math.floor(i / dimensions.x) === idx)
      : predictions.filter((x, i) => i % dimensions.x === idx)

  const normalisedInputs = inputs.map(([x, y]) => (y * 3 + x) / 8)

  const results = network.predict(normalisedInputs)
  network.train([normalisedInputs])

  return results
}

module.exports.createAggregator = createAggregator
module.exports.aggregatePredictions = aggregatePredictions
