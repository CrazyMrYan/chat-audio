if (typeof exports === "undefined") {
  // var play = {
  //   sound: function (wav) {
  //     debug.log(wav);
  //     var e = $("#" + wav);
  //     debug.log(e);
  //     $("#alarm").remove();
  //     $(e).attr("autostart", true);
  //     $("body").append(e);
  //     return wav;
  //   },
  // };
} else {
  var  child_p = require("child_process"),
    exec = child_p.exec,
    spawn = child_p.spawn,
    ee = require("events"),
    util = require("util");
  var Play = (exports.Play = function Play() {
    var self = this;

    if (!(this instanceof Play)) {
      return new Play();
    }
    ee.EventEmitter.call(this);
    this.playerList = ["afplay", "mplayer", "mpg123", "mpg321", "play"];
    this.playerName = false;
    this.checked = 0;
    var i = 0,
      child,
      l = this.playerList.length;
    for (i = 0; i < l; i++) {
      if (!this.playerName) {
        (function inner(name) {
          child = exec(name, function (error, stdout, stderr) {
            self.checked++;
            if (!self.playerName && (error === null || error.code !== 127)) {
              self.playerName = name;
              self.emit("checked");
              return;
            }
            if (name === self.playerList[self.playerList.length - 1]) {
              self.emit("checked");
            }
          });
        })(this.playerList[i]);
      } else {
        break;
      }
    }
  });
  util.inherits(Play, ee.EventEmitter);
  Play.prototype.usePlayer = function usePlayer(name) {
    this.playerName = name;
  };
  Play.prototype.sound = function sound(file, callback) {
    var callback = callback || function () {};
    var self = this;
    if (!this.playerName && this.checked !== this.playerList.length) {
      this.on("checked", function () {
        self.sound.call(self, file, callback);
      });
      return false;
    }
    if (!this.playerName && this.checked === this.playerList.length) {
      console.log("No suitable audio player could be found - exiting.".red);
      console.log(
        "If you know other cmd line music player than these:".red,
        this.playerList
      );
      console.log(
        "You can tell us, and will add them (or you can add them yourself)".red
      );
      this.emit(
        "error",
        new Error("No Suitable Player Exists".red, this.playerList)
      );
      return false;
    }
    var command = [file],
      child = (this.player = spawn(this.playerName, command));
    console.log("playing".magenta + "=>".yellow + file.cyan);
    child.on("exit", function (code, signal) {
      if (code == null || signal != null || code === 1) {
        console.log(
          "couldnt play, had an error " +
            "[code: " +
            code +
            "] " +
            "[signal: " +
            signal +
            "] :" +
            this.playerName.cyan
        );
        this.emit("error", code, signal);
      } else if (code == 127) {
        console.log(self.playerName.cyan + " doesn't exist!".red);
        this.emit("error", code, signal);
      } else if (code == 2) {
        console.log(
          file.cyan +
            "=>".yellow +
            "could not be read by your player:".red +
            self.playerName.cyan
        );
        this.emit("error", code, signal);
      } else if (code == 0) {
        console.log("completed".green + "=>".yellow + file.magenta);
        callback();
      } else {
        console.log(
          self.playerName.cyan + " has an odd error with ".yellow + file.cyan
        );
        console.log(arguments);
        emit("error");
      }
    });
    this.emit("play", true);
    return true;
  };
}
