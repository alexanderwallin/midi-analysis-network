/* eslint new-cap: 0 */
const inquirer = require('inquirer')
const midi = require('midi')

module.exports = async function getMidiInput({ device }) {
  const input = new midi.input()
  const portNames = new Array(input.getPortCount())
    .fill(null)
    .map((nothing, i) => input.getPortName(i))

  if (portNames.length === 0) {
    return null
  }

  let resolvedPort = device
  if (!resolvedPort) {
    const { port } = await inquirer.prompt([
      {
        type: 'list',
        name: 'port',
        message: 'Choose a MIDI port',
        choices: portNames,
      },
    ])
    resolvedPort = port
  }

  const portIdx = portNames.indexOf(resolvedPort)
  if (portIdx === -1) {
    return null
  }

  input.openPort(portIdx)
  return input
}
