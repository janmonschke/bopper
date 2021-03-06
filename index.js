// var Readable = require('stream').Readable
var Stream = require('stream')
var nextTick = require('next-tick')

var inherits = require('util').inherits

module.exports = Bopper

function Bopper(audioContext){
  if (!(this instanceof Bopper)){
    return new Bopper(audioContext)
  }

  //Readable.call(this, { objectMode: true })
  Stream.call(this)
  this.readable = true
  this.writable = false

  this.context = audioContext
  var processor = this._processor = audioContext.createScriptProcessor(1024, 1, 1)

  var handleTick = bopperTick.bind(this)
  this._processor.onaudioprocess = function(){
    nextTick(handleTick)
  }

  var tempo = 120
  var cycleLength = (1 / audioContext.sampleRate) * this._processor.bufferSize

  this._state = {
    lastTo: 0,
    lastEndTime: 0,
    playing: false,
    bpm: tempo,
    beatDuration: 60 / tempo,
    increment: (tempo / 60) * cycleLength,
    cycleLength: cycleLength,
    preCycle: 3
  }

  processor.connect(audioContext.destination)
}

//inherits(Bopper, Readable)
inherits(Bopper, Stream)

var proto = Bopper.prototype

//proto._read = function(){
//  this._state.waiting = true
//}

proto.start = function(){
  this._state.playing = true
}

proto.stop = function(){
  this._state.playing = false
}

proto.setTempo = function(tempo){
  var bps = tempo/60
  var state = this._state
  state.beatDuration = 60/tempo
  state.increment = bps * state.cycleLength
  state.bpm = tempo
  this.emit('tempo', state.bpm)
}

proto.getTempo = function(){
  return this._state.bpm
}

proto.isPlaying = function(){
  return this._state.playing
}

proto.setPosition = function(position){
  this._state.lastTo = parseFloat(position)
}

proto.setSpeed = function(multiplier){
  var state = this._state

  multiplier = parseFloat(multiplier) || 0

  var tempo = state.bpm * multiplier
  var bps = tempo/60

  state.beatDuration = 60/tempo
  state.increment = bps * state.cycleLength
}


proto.getPositionAt = function(time){
  var state = this._state
  var delta = state.lastEndTime - time
  return state.lastTo - (delta / state.beatDuration)
}

proto.getTimeAt = function(position){
  var state = this._state
  var positionOffset = this.getCurrentPosition() - position
  return this.context.currentTime - (positionOffset * state.beatDuration)
}

proto.getCurrentPosition = function(){
  return this.getPositionAt(this.context.currentTime)
}

proto.getNextScheduleTime = function(){
  var state = this._state
  return state.lastEndTime
}

proto.getBeatDuration = function(){
  var state = this._state
  return state.beatDuration
}

proto._schedule = function(time, from, to){
  var state = this._state
  var duration = (to - from) * state.beatDuration
  this.emit('data', {
    from: from,
    to: to,
    time: time,
    duration: duration,
    beatDuration: state.beatDuration
  })
}

function bopperTick(e){
  var state = this._state

  var endTime = this.context.currentTime + (state.cycleLength * state.preCycle)
  var time = state.lastEndTime
  state.lastEndTime = endTime

  if (state.playing){
    var duration = endTime - time
    var length = duration / state.beatDuration

    var from = state.lastTo
    var to = from + length
    state.lastTo = to

    this._schedule(time, from, to)
  }

}