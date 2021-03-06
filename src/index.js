const express = require('express')

const {
  analyse,
  getActiveControls,
  getChannelPredictions,
  getControlPredictions,
  getPredictions,
} = require('./analyse.js')
const getMidiInput = require('./getMidiInput.js')

module.exports = async function run(options) {
  // Create API
  const app = new express()
  app.set('port', process.env.PORT || 8290)

  app.get('/predictions', (req, res) => {
    const predictions = getPredictions()
    res.json({ data: predictions })
  })

  app.get('/channel-predictions', (req, res) => {
    const data = getChannelPredictions()
    res.json({ data })
  })

  app.get('/control-predictions', (req, res) => {
    const data = getControlPredictions()
    res.json({ data })
  })

  app.get('/active-controls', (req, res) => {
    const meta = {
      numControls: options.channels.length * options.controlIds.length,
    }
    const data = getActiveControls()
    res.json({ meta, data })
  })

  app.get('/status', (req, res) => {})

  app.listen(app.get('port'), err => {
    if (err) {
      console.log(`Could not launch analysis API on port ${app.get('port')}:`)
      console.log(err)
    } else {
      console.log(`Running analysis API on port ${app.get('port')} 🤓`)
    }
  })

  const midiInput = await getMidiInput({ device: options.device })

  try {
    const exit = await analyse(midiInput, options)
    exitHandler()
  } catch (err) {
    throw err
  }

  // Exit handler
  async function exitHandler() {
    console.log('exitHandler', { midiInput })
    try {
      if (midiInput) {
        midiInput.close()
        await delay(500)
      }
    } catch (err) {
      console.log('Could not close midi input:')
      console.log(err)
    }

    process.exit(0)
  }

  process.on('exit', exitHandler)
  process.on('SIGINT', exitHandler)
  process.on('SIGUSR1', exitHandler)
  process.on('SIGUSR2', exitHandler)
  process.on('uncaughtException', exitHandler)
}
