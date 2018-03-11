/* eslint new-cap: 0 */
const inquirer = require('inquirer')
const midi = require('midi')

module.exports = async function getMidiInput() {
  const input = new midi.input()
  const portNames = new Array(input.getPortCount())
    .fill(null)
    .map((nothing, i) => input.getPortName(i))

  if (portNames.length === 0) {
    return null
  }

  const { port } = await inquirer.prompt([
    {
      type: 'list',
      name: 'port',
      message: 'Choose a MIDI port',
      choices: portNames,
    },
  ])

  input.openPort(portNames.indexOf(port))
  return input
}
