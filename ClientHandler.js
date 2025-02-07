import EventEmitter from "events"
import { createClient, states } from "minecraft-protocol"
import { CustomCommands } from "./CustomCommands.js"
import { AutoQueue } from "./AutoQueue.js"
import { StateHandler } from "./StateHandler.js"
import { PartyCommands } from "./PartyCommands.js"
import { PartyChatThrottle } from "./PartyChatThrottle.js"
import { TimeDetail } from "./TimeDetail.js"
import { CountdownAlerts } from "./CountdownAlerts.js"
import { BetterGameInfo } from "./BetterGameInfo.js"
import { ConsoleLogger } from "./ConsoleLogger.js"
import { TickCounter } from "./TickCounter.js"
import { WorldTracker } from "./WorldTracker.js"
import { CustomModules } from "./CustomModules.js"

export class ClientHandler extends EventEmitter {
  constructor(userClient, proxy, id) {
    super()

    this.userClient = userClient
    this.proxy = proxy
    this.id = id
    this.proxyClient = createClient({
      host: "mc.hypixel.net",
      username: userClient.username,
      keepAlive: false,
      version: userClient.protocolVersion,
      auth: "microsoft",
      hideErrors: true
    })

    this.destroyed = false

    this.outgoingModifiers = []
    this.incomingModifiers = []

    //due to issues with chunk parsing on 1.18, this does not currently support tick counting on 1.18. I'm working with people on the libary's Discord server to find a solution.
    this.disableTickCounter = userClient.protocolVersion >= 757

    if (!this.disableTickCounter) this.worldTracker = new WorldTracker(this)
    this.stateHandler = new StateHandler(this)
    if (!this.disableTickCounter) this.tickCounter = new TickCounter(this)
    //previously used just for party chat, now it throttles every party command
    this.partyChatThrottle = new PartyChatThrottle(this)
    this.customCommands = new CustomCommands(this)
    this.autoQueue = new AutoQueue(this)
    this.partyCommands = new PartyCommands(this)
    this.timeDetail = new TimeDetail(this)
    this.countdownAlerts = new CountdownAlerts(this)
    this.betterGameInfo = new BetterGameInfo(this)
    this.consoleLogger = new ConsoleLogger(this)
    this.customModules = new CustomModules(this)

    this.bindEventListeners()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.proxy.removeClientHandler(this.id)
    this.emit("destroy")
  }

  bindEventListeners() {
    let userClient = this.userClient
    let proxyClient = this.proxyClient
    userClient.on("packet", (data, meta, buffer) => {
      let replaced = false
      for (let modifier of this.outgoingModifiers) {
        let result = modifier(data, meta)
        if (result) {
          let type = result.type
          if (type === "cancel") {
            return
          } else if (type === "replace") {
            data = result.data
            meta = result.meta
            replaced = true
          }
        }
      }
      if (replaced) {
        proxyClient.write(meta.name, data, meta)
      } else {
        proxyClient.writeRaw(buffer)
      }
    })
    proxyClient.on("packet", (data, meta, buffer) => {
      let replaced = false
      for (let modifier of this.incomingModifiers) {
        let result = modifier(data, meta)
        if (result) {
          let type = result.type
          if (type === "cancel") {
            return
          } else if (type === "replace") {
            data = result.data
            meta = result.meta
            replaced = true
          }
        }
      }
      if (meta.state !== states.PLAY) return
      if (replaced) {
        userClient.write(meta.name, data)
      } else {
        userClient.writeRaw(buffer)
      }
    })
    userClient.on("end", (reason) => {
      proxyClient.end()
      this.destroy()
    })
    proxyClient.on("end", (reason) => {
      userClient.end(`§cProxy lost connection to Hypixel: §r${reason}`)
    })
    userClient.on("error", () => {})
    proxyClient.on("error", () => {})
    //if the proxy client gets kicked while logging in, kick the user client
    proxyClient.once("disconnect", data => {
      userClient.write("kick_disconnect", data)
    })
  }
}