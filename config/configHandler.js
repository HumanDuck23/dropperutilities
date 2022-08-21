import fs from "fs"
import YAML from "yaml"

export let config = {}
export let configFileWorking = false
try {
  let tempConfig = fs.readFileSync("./config.yml", "utf8")
  tempConfig = YAML.parse(tempConfig)
  replaceConfig(tempConfig)
  configFileWorking = true
} catch (error) {
  console.log("No readable config.yml found. Creating a new file. (Error code: " + error.code + ")")
  //create fresh data
  let tempConfig = {
    "server-port": 25565,
    "server-host": "localhost",
    "perfect-maps": [
      "Well, Time, Sewer, Floating Islands, Factory",
      "Well, Time, Floating Islands, Sewer, Factory"
    ],
    "countdown-alert-threshold": 100
  }
  replaceConfig(tempConfig)
  try {
    fs.writeFileSync("./config.yml", YAML.stringify(tempConfig))
    configFileWorking = true
  } catch (error) {
    console.log("Unable to create config.yml. (Error code: " + error.code + ")")
    console.log("Make sure this executable is being ran inside of a folder that it can write to.")
  }
}

//replaces contents of data without replacing the reference so imports still work
function replaceConfig(newConfig) {
  for (let key in config) {
    delete config[key]
  }
  for (let key in newConfig) {
    config[key] = newConfig[key]
  }
}